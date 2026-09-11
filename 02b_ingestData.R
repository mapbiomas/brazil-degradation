#!/usr/bin/env Rscript

# ==============================================================================
# STAGE 01 — PER-YEAR PRODUCTION JOB
#
# GCS shards -> local shards -> validated annual mosaic -> upload final mosaic
# -> independent GRASS Location -> r.in.gdal -> ready for next stage
#
# Run one year:
#   Rscript 02b_ingestData.R 1985
#
# Parallel strategy:
#   - GNU Parallel parallelizes YEARS.
#   - This script is intentionally SINGLE-THREADED within each year.
#   - Do NOT use mclapply() inside this script.
#
# Scientific/data-integrity rules:
#   * no gdalwarp
#   * no reprojection
#   * no resampling
#   * no automatic pixel-grid correction
#   * source and output must be Byte/UInt8, 1 band, NoData=0
#   * all shards in one year must share CRS/resolution/pixel lattice
#   * 1985 establishes the master annual grid
#   * every later annual mosaic must match the 1985 master grid
#
# Final GeoTIFF:
#   Byte / NoData=0 / tiled 512x512 / ZSTD level 9 / PREDICTOR=2
#
# GRASS:
#   one independent Location per year:
#       grassdata/COL11_1985/PERMANENT
#       grassdata/COL11_1986/PERMANENT
#       ...
#
#   annual categorical raster:
#       nativeMask_1985
#       nativeMask_1986
#       ...
#
# Required system commands:
#   grass, gdalinfo, gdalbuildvrt, gdal_translate
#
# Required R packages:
#   googleCloudStorageR, rgrass, jsonlite
# ==============================================================================


# ------------------------------------------------------------------------------
# 00. ARGUMENT
# ------------------------------------------------------------------------------

args <- commandArgs(trailingOnly = TRUE)

if (length(args) != 1L) {
  stop("Usage: Rscript 02b_ingestData.R <year>")
}

year <- suppressWarnings(as.integer(args[1]))

if (is.na(year) || year < 1985L || year > 2025L) {
  stop("Year must be an integer between 1985 and 2025.")
}


# ------------------------------------------------------------------------------
# 01. PACKAGES
# ------------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(googleCloudStorageR)
  library(rgrass)
  library(jsonlite)
})


# ------------------------------------------------------------------------------
# 02. FORCE ONE CPU THREAD PER YEAR
#
# GNU Parallel is responsible for parallelism across years.
# These settings prevent hidden nested parallelism.
# ------------------------------------------------------------------------------

Sys.setenv(
  OMP_NUM_THREADS       = "1",
  OPENBLAS_NUM_THREADS  = "1",
  MKL_NUM_THREADS       = "1",
  VECLIB_MAXIMUM_THREADS = "1",
  NUMEXPR_NUM_THREADS   = "1",
  GDAL_NUM_THREADS      = "1",
  VRT_NUM_THREADS       = "1"
)

options(mc.cores = 1L)


# ------------------------------------------------------------------------------
# 03. SETTINGS
#
# All important paths can be overridden with environment variables.
# ------------------------------------------------------------------------------

cfg <- list(

  # Authentication JSON.
  key_file = Sys.getenv(
    "MB_GCS_KEY",
    "../COL101/mapbiomas-drc-0c17477b4f08.json"
  ),

  # GCS.
  bucket = Sys.getenv(
    "MB_BUCKET",
    "shared-development-storage"
  ),

  input_prefix = Sys.getenv(
    "MB_GCS_INPUT_PREFIX",
    "AUXILIARES/DEGRADACAO/COL_11/temp"
  ),

  output_prefix = Sys.getenv(
    "MB_GCS_OUTPUT_PREFIX",
    "AUXILIARES/DEGRADACAO/COL_11/nativeMask"
  ),

  file_prefix = Sys.getenv(
    "MB_FILE_PREFIX",
    "nativeMask-classification_"
  ),

  # Local working directories.
  local_tif_dir = Sys.getenv(
    "MB_LOCAL_TIF_DIR",
    "./tif"
  ),

  grass_db = Sys.getenv(
    "MB_GRASSDB",
    "./grassdata"
  ),

  log_dir = Sys.getenv(
    "MB_LOG_DIR",
    "./logs/ingestion"
  ),

  # 1985 must run first to establish master grid.
  bootstrap_year = as.integer(Sys.getenv(
    "MB_BOOTSTRAP_YEAR",
    "1985"
  )),

  # GDAL output.
  block_size = as.integer(Sys.getenv(
    "MB_BLOCK_SIZE",
    "512"
  )),

  zstd_level = as.integer(Sys.getenv(
    "MB_ZSTD_LEVEL",
    "9"
  )),

  # Cache is MB, per process. This is not an extra CPU thread.
  gdal_cache_mb = as.integer(Sys.getenv(
    "MB_GDAL_CACHE_MB",
    "1024"
  )),

  # r.in.gdal memory in MB, per annual process.
  grass_import_memory_mb = as.integer(Sys.getenv(
    "MB_GRASS_IMPORT_MEMORY_MB",
    "2048"
  )),

  # Restart behavior.
  rebuild_mosaic = tolower(Sys.getenv(
    "MB_REBUILD_MOSAIC",
    "false"
  )) %in% c("true", "1", "yes"),

  reimport_grass = tolower(Sys.getenv(
    "MB_REIMPORT_GRASS",
    "false"
  )) %in% c("true", "1", "yes"),

  clean_shards_after_success = tolower(Sys.getenv(
    "MB_CLEAN_SHARDS",
    "true"
  )) %in% c("true", "1", "yes"),

  # Keep final local TIFF for inspection/reuse.
  # Set MB_KEEP_FINAL_TIF=false after the workflow is validated if disk matters.
  keep_final_tif = tolower(Sys.getenv(
    "MB_KEEP_FINAL_TIF",
    "true"
  )) %in% c("true", "1", "yes"),

  # Metadata floating-point tolerance only.
  # This NEVER changes a raster.
  grid_tolerance = as.numeric(Sys.getenv(
    "MB_GRID_TOLERANCE",
    "1e-7"
  ))
)


# Clean prefix formatting.
cfg$input_prefix  <- sub("^/+", "", sub("/+$", "", cfg$input_prefix))
cfg$output_prefix <- sub("^/+", "", sub("/+$", "", cfg$output_prefix))


# ------------------------------------------------------------------------------
# 04. LOGGING
# ------------------------------------------------------------------------------

dir.create(cfg$log_dir, recursive = TRUE, showWarnings = FALSE)

# One directory per year keeps the ingestion logs and telemetry together:
# logs/ingestion/1985/02b_ingestData.log
# logs/ingestion/1985/status.json
year_log_dir <- file.path(
  cfg$log_dir,
  as.character(year)
)

dir.create(
  year_log_dir,
  recursive = TRUE,
  showWarnings = FALSE
)

log_file <- file.path(
  year_log_dir,
  "02b_ingestData.log"
)

# Persistent machine-readable status used by monitor/02b_ingestData_monitor.R.
status_file <- file.path(
  year_log_dir,
  "status.json"
)

job_started_at <- Sys.time()
completed_steps <- character(0)


write_status <- function(
  state,
  current_step = "",
  message = "",
  step_started_at = NA
) {

  payload <- list(
    year = as.integer(year),
    pid = as.integer(Sys.getpid()),
    state = as.character(state),
    current_step = as.character(current_step),
    last_completed_step = if (length(completed_steps)) {
      tail(completed_steps, 1)
    } else {
      ""
    },
    completed_steps = completed_steps,
    job_started_at = format(
      job_started_at,
      "%Y-%m-%dT%H:%M:%S%z"
    ),
    step_started_at = if (
      length(step_started_at) == 1L &&
      !is.na(step_started_at)
    ) {
      format(
        as.POSIXct(step_started_at),
        "%Y-%m-%dT%H:%M:%S%z"
      )
    } else {
      ""
    },
    updated_at = format(
      Sys.time(),
      "%Y-%m-%dT%H:%M:%S%z"
    ),
    elapsed_seconds = as.numeric(
      difftime(
        Sys.time(),
        job_started_at,
        units = "secs"
      )
    ),
    message = as.character(message)
  )

  # Atomic-ish write: dashboard will never intentionally read a half-written JSON.
  tmp <- paste0(
    status_file,
    ".",
    Sys.getpid(),
    ".tmp"
  )

  jsonlite::write_json(
    payload,
    tmp,
    pretty = TRUE,
    auto_unbox = TRUE,
    digits = 16
  )

  if (!file.rename(
    tmp,
    status_file
  )) {
    file.copy(
      tmp,
      status_file,
      overwrite = TRUE
    )
    unlink(tmp)
  }

  invisible(payload)
}

log_message <- function(...) {

  msg <- paste0(...)

  timestamp <- format(
    Sys.time(),
    "%Y-%m-%d %H:%M:%S"
  )

  line <- paste0(
    "[",
    timestamp,
    "] ",
    msg,
    "\n"
  )

  cat(line)

  cat(
    line,
    file = log_file,
    append = TRUE
  )
}


log_step <- function(step, expr) {

  log_message(
    "---- ",
    step,
    " START ----"
  )

  t0 <- Sys.time()

  write_status(
    state = "RUNNING",
    current_step = step,
    message = paste0(step, " running"),
    step_started_at = t0
  )

  result <- tryCatch(
    force(expr),
    error = function(e) {

      elapsed <- as.numeric(
        difftime(
          Sys.time(),
          t0,
          units = "secs"
        )
      )

      log_message(
        "ERROR in ",
        step,
        " after ",
        round(elapsed, 1),
        " s: ",
        conditionMessage(e)
      )

      write_status(
        state = "ERROR",
        current_step = step,
        message = conditionMessage(e),
        step_started_at = t0
      )

      stop(e)
    }
  )

  elapsed <- as.numeric(
    difftime(
      Sys.time(),
      t0,
      units = "secs"
    )
  )

  completed_steps <<- unique(
    c(
      completed_steps,
      step
    )
  )

  log_message(
    "---- ",
    step,
    " END (",
    round(elapsed, 1),
    " s) ----"
  )

  write_status(
    state = "RUNNING",
    current_step = "BETWEEN_STEPS",
    message = paste0(step, " completed")
  )

  invisible(result)
}


# ------------------------------------------------------------------------------
# 05. GENERAL HELPERS
# ------------------------------------------------------------------------------

`%||%` <- function(x, y) {
  if (is.null(x) || length(x) == 0L) y else x
}


need_command <- function(x) {

  p <- Sys.which(x)

  if (!nzchar(p)) {
    stop(
      paste0(
        "Required command not found in PATH: ",
        x
      )
    )
  }

  p
}


normalize_wkt <- function(x) {

  if (
    is.null(x) ||
    length(x) == 0L
  ) {
    return("")
  }

  gsub(
    "[[:space:]]+",
    " ",
    trimws(x)
  )
}


near_equal <- function(
  x,
  y,
  tol = cfg$grid_tolerance
) {

  if (length(x) != length(y)) {
    return(FALSE)
  }

  all(
    abs(
      as.numeric(x) -
      as.numeric(y)
    ) <= tol
  )
}


run_cmd <- function(
  command,
  arguments = character(),
  capture = FALSE
) {

  quoted <- vapply(
    arguments,
    shQuote,
    character(1)
  )

  printable <- paste(
    c(
      shQuote(command),
      quoted
    ),
    collapse = " "
  )

  log_message("$ ", printable)

  if (capture) {

    ans <- suppressWarnings(
      system2(
        command,
        args = quoted,
        stdout = TRUE,
        stderr = TRUE
      )
    )

    status <- attr(
      ans,
      "status"
    ) %||% 0L

    if (as.integer(status) != 0L) {
      stop(
        paste0(
          "Command failed: ",
          command,
          "\n",
          paste(
            ans,
            collapse = "\n"
          )
        )
      )
    }

    return(ans)
  }

  status <- system2(
    command,
    args = quoted
  )

  if (as.integer(status) != 0L) {
    stop(
      paste0(
        "Command returned status ",
        status,
        ": ",
        command
      )
    )
  }

  invisible(status)
}


# ------------------------------------------------------------------------------
# 06. PREFLIGHT
# ------------------------------------------------------------------------------

grass_exec       <- need_command("grass")
gdalinfo_exec    <- need_command("gdalinfo")
gdalbuildvrt_exec <- need_command("gdalbuildvrt")
gdaltranslate_exec <- need_command("gdal_translate")

if (!file.exists(cfg$key_file)) {
  stop(
    paste0(
      "GCS JSON key does not exist: ",
      cfg$key_file
    )
  )
}

cfg$key_file <- normalizePath(
  cfg$key_file,
  mustWork = TRUE
)

dir.create(
  cfg$local_tif_dir,
  recursive = TRUE,
  showWarnings = FALSE
)

dir.create(
  cfg$grass_db,
  recursive = TRUE,
  showWarnings = FALSE
)


# Confirm GTiff driver advertises ZSTD.
gtiff_capabilities <- run_cmd(
  gdalinfo_exec,
  c(
    "--format",
    "GTiff"
  ),
  capture = TRUE
)

if (!any(
  grepl(
    "ZSTD",
    gtiff_capabilities,
    fixed = TRUE
  )
)) {
  stop(
    "Your GDAL GeoTIFF driver does not advertise ZSTD support."
  )
}


# Read GDAL version number.
gdal_version_line <- run_cmd(
  gdalinfo_exec,
  "--version",
  capture = TRUE
)[1]

gdal_version <- sub(
  "^GDAL[[:space:]]+([0-9.]+).*$",
  "\\1",
  gdal_version_line
)

log_message(
  "===== YEAR ",
  year,
  " ====="
)

log_message(
  "GDAL: ",
  gdal_version_line
)

log_message(
  "JSON key: ",
  cfg$key_file
)


# ------------------------------------------------------------------------------
# 07. GCS AUTH
#
# GNU Parallel launches a separate R process for every year.
# Each process authenticates itself once here.
# ------------------------------------------------------------------------------

write_status(
  state = "RUNNING",
  current_step = "STARTING",
  message = "Annual worker started"
)

log_step("GCS_AUTH", {

  gcs_auth(
    cfg$key_file
  )

  gcs_global_bucket(
    cfg$bucket
  )

})


# ------------------------------------------------------------------------------
# 08. YEAR-SPECIFIC PATHS
# ------------------------------------------------------------------------------

annual_name <- paste0(
  cfg$file_prefix,
  year
)

remote_year_prefix <- paste0(
  cfg$input_prefix,
  "/",
  annual_name
)

remote_final_name <- paste0(
  cfg$output_prefix,
  "/",
  annual_name,
  ".tif"
)


year_work_dir <- file.path(
  cfg$local_tif_dir,
  "shards",
  as.character(year)
)

dir.create(
  year_work_dir,
  recursive = TRUE,
  showWarnings = FALSE
)


tile_list_file <- file.path(
  year_work_dir,
  "tiles.txt"
)

vrt_file <- file.path(
  year_work_dir,
  paste0(
    annual_name,
    ".vrt"
  )
)

final_tif <- file.path(
  cfg$local_tif_dir,
  paste0(
    annual_name,
    ".tif"
  )
)

master_grid_file <- file.path(
  cfg$local_tif_dir,
  "master_grid.json"
)


location_name <- paste0(
  "COL11_",
  year
)

location_path <- file.path(
  cfg$grass_db,
  location_name
)

mapset_name <- "PERMANENT"

grass_raster <- paste0(
  "nativeMask_",
  year
)


# ------------------------------------------------------------------------------
# 08B. EXACT GCS OBJECT SIZE
#
# IMPORTANT:
# googleCloudStorageR::gcs_list_objects() formats its `size` column for
# display (for example MB/GB). It must NOT be converted with as.numeric().
# ------------------------------------------------------------------------------

gcs_object_size_bytes <- function(object_name) {

  meta <- gcs_get_object(
    object_name = object_name,
    bucket = cfg$bucket,
    meta = TRUE
  )

  raw_size <- meta$size %||% NA_character_

  size_bytes <- suppressWarnings(
    as.numeric(
      as.character(
        raw_size
      )
    )
  )

  if (
    length(size_bytes) != 1L ||
    is.na(size_bytes) ||
    !is.finite(size_bytes) ||
    size_bytes < 0
  ) {
    stop(
      paste0(
        "Could not obtain exact GCS object size in bytes for: ",
        object_name,
        " | metadata size=",
        paste(raw_size, collapse = ",")
      )
    )
  }

  size_bytes
}


# ------------------------------------------------------------------------------
# 09. GCS LISTING
# ------------------------------------------------------------------------------

list_remote_shards <- function() {

  x <- gcs_list_objects(
    bucket = cfg$bucket,
    prefix = remote_year_prefix,
    detail = "full"
  )

  if (
    is.null(x) ||
    nrow(x) == 0L
  ) {
    stop(
      paste0(
        "No objects found for prefix: ",
        remote_year_prefix
      )
    )
  }

  # Keep only GeoTIFFs belonging to exactly this year's export.
  #
  # Handles both:
  #   nativeMask-classification_1985.tif
  #
  # and Earth Engine shard names such as:
  #   nativeMask-classification_1985-0000000000-0000000000.tif

  object_basename <- basename(x$name)

  keep <- startsWith(
    object_basename,
    annual_name
  ) & grepl(
    "\\.tif$",
    object_basename,
    ignore.case = TRUE
  )

  x <- x[
    keep,
    ,
    drop = FALSE
  ]

  if (nrow(x) == 0L) {
    stop(
      paste0(
        "No annual TIFF shards matched prefix: ",
        remote_year_prefix
      )
    )
  }

  x <- x[
    order(x$name),
    ,
    drop = FALSE
  ]

  x
}


remote_signature <- function(x) {

  cols <- intersect(
    c(
      "name",
      "size",
      "generation",
      "crc32c",
      "md5Hash"
    ),
    names(x)
  )

  x[, cols, drop = FALSE]
}


# ------------------------------------------------------------------------------
# 10. DOWNLOAD SHARDS
#
# IMPORTANT:
# Downloads are sequential inside the annual process.
# Parallelism happens across YEARS via GNU Parallel.
# ------------------------------------------------------------------------------

download_with_retry <- function(
  object_name,
  destination,
  expected_size = NA_real_,
  attempts = 3L
) {

  for (attempt in seq_len(attempts)) {

    # Resume behavior:
    # if local file already exists with expected byte size, reuse it.
    if (
      file.exists(destination) &&
      !is.na(expected_size) &&
      file.info(destination)$size == expected_size
    ) {

      log_message(
        "Already downloaded and size OK: ",
        basename(destination)
      )

      return(invisible(TRUE))
    }


    if (file.exists(destination)) {
      unlink(destination)
    }


    log_message(
      "Downloading attempt ",
      attempt,
      "/",
      attempts,
      ": ",
      object_name
    )


    ok <- tryCatch(
      {

        gcs_get_object(
          object_name = object_name,
          bucket = cfg$bucket,
          saveToDisk = destination,
          overwrite = TRUE
        )

        TRUE
      },
      error = function(e) {

        log_message(
          "Download error: ",
          conditionMessage(e)
        )

        FALSE
      }
    )


    if (ok && file.exists(destination)) {

      local_size <- file.info(
        destination
      )$size

      if (
        is.na(expected_size) ||
        local_size == expected_size
      ) {
        return(invisible(TRUE))
      }

      log_message(
        "Size mismatch after download. Local=",
        local_size,
        " GCS=",
        expected_size
      )
    }


    if (attempt < attempts) {
      Sys.sleep(
        2^attempt
      )
    }
  }


  stop(
    paste0(
      "Failed downloading object: ",
      object_name
    )
  )
}


download_shards <- function() {

  # List before transfer.
  before <- list_remote_shards()

  log_message(
    "Remote shards detected: ",
    nrow(before)
  )


  expected_sizes <- setNames(
    numeric(nrow(before)),
    before$name
  )


  for (i in seq_len(nrow(before))) {

    object_name <- before$name[i]

    # gcs_list_objects() exposes a human-formatted size.
    # Query object metadata for the exact size in bytes.
    expected_size <- gcs_object_size_bytes(
      object_name
    )

    expected_sizes[
      object_name
    ] <- expected_size

    destination <- file.path(
      year_work_dir,
      basename(object_name)
    )


    download_with_retry(
      object_name = object_name,
      destination = destination,
      expected_size = expected_size
    )
  }


  # List again after transfer.
  #
  # If object generations changed while downloading, the EE export may still
  # be active. Abort rather than build a partial/inconsistent mosaic.
  after <- list_remote_shards()


  if (!identical(
    remote_signature(before),
    remote_signature(after)
  )) {
    stop(
      paste0(
        "The GCS object set/generation changed during download. ",
        "The Earth Engine export may still be writing this year. ",
        "Retry after the EE export is COMPLETED."
      )
    )
  }


  local_files <- file.path(
    year_work_dir,
    basename(after$name)
  )


  if (!all(
    file.exists(local_files)
  )) {
    stop(
      "At least one expected local shard is missing."
    )
  }


  local_sizes <- file.info(
    local_files
  )$size


  if (any(
    is.na(
      local_sizes
    )
  )) {
    stop(
      "Could not obtain local byte size for at least one downloaded shard."
    )
  }


  # Do NOT use after$size here: googleCloudStorageR formats list-object sizes
  # for humans. Use the exact byte sizes collected from raw object metadata.
  remote_sizes <- unname(
    expected_sizes[
      after$name
    ]
  )


  if (any(
    is.na(
      remote_sizes
    )
  )) {
    stop(
      "Missing exact GCS byte size for at least one downloaded shard."
    )
  }


  if (!all(
    local_sizes == remote_sizes
  )) {

    bad <- which(
      local_sizes != remote_sizes
    )

    stop(
      paste0(
        "Downloaded shard byte-size mismatch: ",
        paste(
          basename(
            local_files[bad]
          ),
          collapse = ", "
        )
      )
    )
  }


  log_message(
    "All ",
    length(local_files),
    " downloaded shards match the exact GCS byte size."
  )


  normalizePath(
    local_files,
    mustWork = TRUE
  )
}


# ------------------------------------------------------------------------------
# 11. GDAL METADATA
# ------------------------------------------------------------------------------

read_gdal_metadata <- function(path) {

  txt <- run_cmd(
    gdalinfo_exec,
    c(
      "-json",
      path
    ),
    capture = TRUE
  )


  x <- jsonlite::fromJSON(
    paste(
      txt,
      collapse = "\n"
    ),
    simplifyVector = FALSE
  )


  bands <- x$bands %||% list()

  if (length(bands) != 1L) {
    stop(
      paste0(
        "Expected exactly 1 band: ",
        path
      )
    )
  }


  band <- bands[[1]]

  image_structure <- (
    x$metadata %||% list()
  )$IMAGE_STRUCTURE %||% list()


  list(

    path = path,

    size = as.integer(
      unlist(
        x$size
      )
    ),

    geotransform = as.numeric(
      unlist(
        x$geoTransform
      )
    ),

    wkt = normalize_wkt(
      (
        x$coordinateSystem %||%
        list()
      )$wkt %||% ""
    ),

    datatype = as.character(
      band$type %||% ""
    ),

    nodata = as.numeric(
      band$noDataValue %||%
      NA_real_
    ),

    block = as.integer(
      unlist(
        band$block %||%
        c(
          NA_integer_,
          NA_integer_
        )
      )
    ),

    compression = as.character(
      image_structure$COMPRESSION %||% ""
    )
  )
}


# ------------------------------------------------------------------------------
# 12. VALIDATE SOURCE SHARDS
# ------------------------------------------------------------------------------

validate_shards <- function(files) {

  if (length(files) < 1L) {
    stop("No source shards supplied.")
  }


  log_message(
    "Validating ",
    length(files),
    " local shard(s)."
  )


  ref <- read_gdal_metadata(
    files[1]
  )


  if (!identical(
    ref$datatype,
    "Byte"
  )) {
    stop(
      paste0(
        "Source must be Byte/UInt8. Found: ",
        ref$datatype
      )
    )
  }


  if (
    is.na(ref$nodata) ||
    ref$nodata != 0
  ) {
    stop(
      "Source NoData must be 0."
    )
  }


  if (!nzchar(
    ref$wkt
  )) {
    stop(
      "Source CRS/WKT is missing."
    )
  }


  if (
    length(ref$geotransform) != 6L ||
    !near_equal(
      ref$geotransform[c(3, 5)],
      c(0, 0)
    )
  ) {
    stop(
      "Rotated/skewed source grids are not allowed."
    )
  }


  if (length(files) > 1L) {

    for (f in files[-1]) {

      m <- read_gdal_metadata(
        f
      )


      if (!identical(
        m$datatype,
        ref$datatype
      )) {
        stop(
          paste0(
            "Datatype mismatch: ",
            f
          )
        )
      }


      if (
        is.na(m$nodata) ||
        m$nodata != ref$nodata
      ) {
        stop(
          paste0(
            "NoData mismatch: ",
            f
          )
        )
      }


      if (!identical(
        m$wkt,
        ref$wkt
      )) {
        stop(
          paste0(
            "CRS mismatch: ",
            f
          )
        )
      }


      # Same xres, rotation, skew, yres.
      if (!near_equal(
        m$geotransform[c(2, 3, 5, 6)],
        ref$geotransform[c(2, 3, 5, 6)]
      )) {
        stop(
          paste0(
            "Resolution/rotation mismatch: ",
            f
          )
        )
      }


      # Same pixel lattice:
      # origins may differ, but only by whole pixels.
      dx <- (
        m$geotransform[1] -
        ref$geotransform[1]
      ) /
        ref$geotransform[2]


      dy <- (
        m$geotransform[4] -
        ref$geotransform[4]
      ) /
        ref$geotransform[6]


      if (
        abs(
          dx -
          round(dx)
        ) > cfg$grid_tolerance ||
        abs(
          dy -
          round(dy)
        ) > cfg$grid_tolerance
      ) {

        stop(
          paste0(
            "Pixel-grid alignment mismatch: ",
            f
          )
        )
      }
    }
  }


  log_message(
    "All source shards share CRS, resolution and pixel lattice."
  )

  invisible(ref)
}


# ------------------------------------------------------------------------------
# 13. BUILD VRT + FINAL MOSAIC
#
# No warp. No reprojection. No resampling.
# ------------------------------------------------------------------------------

build_mosaic <- function(files) {

  validate_shards(
    files
  )


  writeLines(
    files,
    tile_list_file,
    useBytes = TRUE
  )


  if (file.exists(
    vrt_file
  )) {
    unlink(
      vrt_file
    )
  }


  vrt_args <- c(
    "--config",
    "GDAL_NUM_THREADS",
    "1",

    "--config",
    "VRT_NUM_THREADS",
    "1",

    "-strict",

    "-srcnodata",
    "0",

    "-vrtnodata",
    "0"
  )


  # GDAL 3.11+ can explicitly reject mixed source resolution.
  # Earlier versions are already protected by validate_shards().
  if (
    nzchar(gdal_version) &&
    utils::compareVersion(
      gdal_version,
      "3.11.0"
    ) >= 0
  ) {

    vrt_args <- c(
      vrt_args,
      "-resolution",
      "same"
    )
  }


  vrt_args <- c(
    vrt_args,

    "-input_file_list",
    tile_list_file,

    vrt_file
  )


  run_cmd(
    gdalbuildvrt_exec,
    vrt_args
  )


  if (!file.exists(
    vrt_file
  )) {
    stop(
      "gdalbuildvrt did not create the VRT."
    )
  }


  if (file.exists(
    final_tif
  )) {
    unlink(
      final_tif
    )
  }


  translate_args <- c(

    "--config",
    "GDAL_CACHEMAX",
    as.character(
      cfg$gdal_cache_mb
    ),

    "--config",
    "GDAL_NUM_THREADS",
    "1",

    "--config",
    "VRT_NUM_THREADS",
    "1",

    "-strict",

    "-of",
    "GTiff",

    "-ot",
    "Byte",

    "-a_nodata",
    "0",

    "-co",
    "TILED=YES",

    "-co",
    paste0(
      "BLOCKXSIZE=",
      cfg$block_size
    ),

    "-co",
    paste0(
      "BLOCKYSIZE=",
      cfg$block_size
    ),

    "-co",
    "COMPRESS=ZSTD",

    "-co",
    paste0(
      "ZSTD_LEVEL=",
      cfg$zstd_level
    ),

    "-co",
    "PREDICTOR=2",

    # EXACTLY one compression worker per annual process.
    "-co",
    "NUM_THREADS=1",

    "-co",
    "BIGTIFF=IF_SAFER",

    vrt_file,

    final_tif
  )


  run_cmd(
    gdaltranslate_exec,
    translate_args
  )


  if (!file.exists(
    final_tif
  )) {
    stop(
      "gdal_translate did not create final GeoTIFF."
    )
  }


  invisible(
    final_tif
  )
}


# ------------------------------------------------------------------------------
# 14. MASTER GRID
#
# 1985 is the authoritative annual grid.
# Run it BEFORE starting 1986-2025 in GNU Parallel.
# ------------------------------------------------------------------------------

grid_record <- function(meta) {

  list(
    size = meta$size,
    geotransform = meta$geotransform,
    wkt = meta$wkt,
    datatype = meta$datatype,
    nodata = meta$nodata
  )
}


validate_final_and_master <- function() {

  m <- read_gdal_metadata(
    final_tif
  )


  if (!identical(
    m$datatype,
    "Byte"
  )) {
    stop(
      paste0(
        "Final datatype is ",
        m$datatype,
        "; expected Byte."
      )
    )
  }


  if (
    is.na(m$nodata) ||
    m$nodata != 0
  ) {
    stop(
      "Final NoData must be 0."
    )
  }


  if (!identical(
    toupper(m$compression),
    "ZSTD"
  )) {
    stop(
      paste0(
        "Expected ZSTD compression; found: ",
        m$compression
      )
    )
  }


  if (
    length(m$block) != 2L ||
    any(
      m$block !=
        cfg$block_size
    )
  ) {
    stop(
      paste0(
        "Unexpected GeoTIFF tile size: ",
        paste(
          m$block,
          collapse = "x"
        )
      )
    )
  }


  if (!file.exists(
    master_grid_file
  )) {

    if (year != cfg$bootstrap_year) {
      stop(
        paste0(
          "Master grid is missing. ",
          "Run year ",
          cfg$bootstrap_year,
          " first."
        )
      )
    }


    jsonlite::write_json(
      grid_record(m),
      master_grid_file,
      pretty = TRUE,
      auto_unbox = TRUE,
      digits = 16
    )


    log_message(
      "Master grid created: ",
      master_grid_file
    )

    return(
      invisible(m)
    )
  }


  master <- jsonlite::fromJSON(
    master_grid_file,
    simplifyVector = TRUE
  )


  if (!identical(
    as.integer(m$size),
    as.integer(master$size)
  )) {
    stop(
      "Final mosaic dimensions do not match master grid."
    )
  }


  if (!near_equal(
    m$geotransform,
    master$geotransform
  )) {
    stop(
      "Final mosaic geotransform does not match master grid."
    )
  }


  if (!identical(
    m$wkt,
    normalize_wkt(
      master$wkt
    )
  )) {
    stop(
      "Final mosaic CRS does not match master grid."
    )
  }


  if (!identical(
    m$datatype,
    as.character(
      master$datatype
    )
  )) {
    stop(
      "Final mosaic datatype does not match master grid."
    )
  }


  if (!near_equal(
    m$nodata,
    as.numeric(
      master$nodata
    )
  )) {
    stop(
      "Final mosaic NoData does not match master grid."
    )
  }


  log_message(
    "Final annual mosaic matches master grid."
  )

  invisible(m)
}


# ------------------------------------------------------------------------------
# 15. UPLOAD FINAL MOSAIC TO GCS
# ------------------------------------------------------------------------------

get_remote_final <- function() {

  x <- gcs_list_objects(
    bucket = cfg$bucket,
    prefix = remote_final_name,
    detail = "summary"
  )


  if (
    is.null(x) ||
    nrow(x) == 0L
  ) {
    return(NULL)
  }


  x <- x[
    x$name ==
      remote_final_name,
    ,
    drop = FALSE
  ]


  if (nrow(x) == 0L) {
    return(NULL)
  }


  x[1, , drop = FALSE]
}


upload_final_mosaic <- function() {

  local_size <- file.info(
    final_tif
  )$size


  existing <- get_remote_final()


  if (!is.null(
    existing
  )) {

    existing_size <- gcs_object_size_bytes(
      remote_final_name
    )


    if (
      !is.na(existing_size) &&
      existing_size == local_size
    ) {

      log_message(
        "Final GCS object already exists with identical byte size; skipping upload: ",
        remote_final_name
      )

      return(
        invisible(TRUE)
      )
    }


    log_message(
      "Remote final object exists but size differs; replacing it."
    )
  }


  # Force resumable upload for the large annual mosaic.
  gcs_upload(
    file = final_tif,
    bucket = cfg$bucket,
    name = remote_final_name,
    predefinedAcl = "bucketLevel",
    upload_type = "resumable"
  )


  uploaded <- get_remote_final()


  if (is.null(
    uploaded
  )) {
    stop(
      "Final object was not found in GCS after upload."
    )
  }


  remote_size <- gcs_object_size_bytes(
    remote_final_name
  )


  if (
    is.na(remote_size) ||
    remote_size != local_size
  ) {

    stop(
      paste0(
        "Uploaded GCS object size mismatch. Local=",
        local_size,
        " Remote=",
        remote_size
      )
    )
  }


  log_message(
    "Uploaded final mosaic: gs://",
    cfg$bucket,
    "/",
    remote_final_name
  )


  invisible(TRUE)
}


# ------------------------------------------------------------------------------
# 16. CREATE INDEPENDENT GRASS LOCATION
#
# One Location per year is intentionally retained from your existing workflow.
# This isolates parallel sessions.
# ------------------------------------------------------------------------------

create_grass_location <- function() {

  if (!dir.exists(
    location_path
  )) {

    log_message(
      "Creating GRASS Location: ",
      location_name
    )


    # Construct the Location path explicitly.
    target_location <- file.path(
      normalizePath(
        cfg$grass_db,
        mustWork = TRUE
      ),
      location_name
    )


    cmd <- sprintf(
      "%s -c %s %s -e",
      shQuote(
        grass_exec
      ),
      shQuote(
        normalizePath(
          final_tif,
          mustWork = TRUE
        )
      ),
      shQuote(
        target_location
      )
    )


    log_message(
      "$ ",
      cmd
    )


    status <- system(
      cmd
    )


    if (status != 0L) {
      stop(
        "Failed creating GRASS Location."
      )
    }
  }


  invisible(TRUE)
}


# ------------------------------------------------------------------------------
# 17. INIT R/GRASS + IMPORT
#
# We intentionally use r.in.gdal, matching your existing production strategy.
#
# IMPORTANT change:
#   DO NOT use flag -o.
#
# Since the Location was created directly from this mosaic, projection mismatch
# should never happen. If it does, the import must fail rather than override it.
# ------------------------------------------------------------------------------

ingest_into_grass <- function() {

  create_grass_location()


  grass_path <- system(
    "grass --config path",
    intern = TRUE
  )[1]


  grass_home <- file.path(
    tempdir(),
    paste0(
      "grass_",
      year,
      "_",
      Sys.getpid()
    )
  )


  dir.create(
    grass_home,
    recursive = TRUE,
    showWarnings = FALSE
  )


  initGRASS(
    gisBase = grass_path,
    home = grass_home,
    gisDbase = normalizePath(
      cfg$grass_db,
      mustWork = TRUE
    ),
    location = location_name,
    mapset = mapset_name,
    override = TRUE,
    pid = Sys.getpid(),
    remove_GISRC = TRUE,
    tempdir = grass_home
  )


  # Check whether the raster already exists.
  existing <- execGRASS(
    "g.list",
    parameters = list(
      type = "raster"
    ),
    intern = TRUE
  )


  raster_exists <- grass_raster %in%
    trimws(existing)


  if (
    raster_exists &&
    !cfg$reimport_grass
  ) {

    log_message(
      "GRASS raster already exists; skipping r.in.gdal: ",
      grass_raster
    )

  } else {

    execGRASS(
      "r.in.gdal",

      # No projection override (-o).
      flags = c(
        "overwrite",
        "quiet"
      ),

      parameters = list(

        input = normalizePath(
          final_tif,
          mustWork = TRUE
        ),

        output = grass_raster,

        memory = as.integer(
          cfg$grass_import_memory_mb
        ),

        # Keep GDAL single-threaded inside this annual process.
        gdal_config = "GDAL_NUM_THREADS=1"
      )
    )
  }


  # Verify import.
  rlist <- execGRASS(
    "g.list",
    parameters = list(
      type = "raster"
    ),
    intern = TRUE
  )


  if (!(
    grass_raster %in%
    trimws(
      rlist
    )
  )) {

    stop(
      paste0(
        "GRASS raster import failed: ",
        grass_raster
      )
    )
  }


  # Exact annual region.
  execGRASS(
    "g.region",
    parameters = list(
      raster = grass_raster,
      align = grass_raster
    )
  )


  # Log final GRASS metadata.
  grass_rinfo <- execGRASS(
    "r.info",
    flags = "g",
    parameters = list(
      map = grass_raster
    ),
    intern = TRUE
  )


  log_message(
    "GRASS raster ready: ",
    grass_raster,
    "@",
    mapset_name
  )


  cat(
    paste0(
      grass_rinfo,
      collapse = "\n"
    ),
    "\n",
    file = log_file,
    append = TRUE
  )


  # Explicit cleanup is useful in long-running/multi-session workflows.
  try(
    unlink_.gislock(),
    silent = TRUE
  )


  invisible(TRUE)
}


# ------------------------------------------------------------------------------
# 18. CLEANUP
# ------------------------------------------------------------------------------

cleanup_after_success <- function() {

  # Shards and VRT can be removed because:
  #   1) final mosaic is uploaded to GCS
  #   2) r.in.gdal copied the raster into the GRASS Location

  if (
    cfg$clean_shards_after_success &&
    dir.exists(
      year_work_dir
    )
  ) {

    unlink(
      year_work_dir,
      recursive = TRUE,
      force = TRUE
    )


    log_message(
      "Removed local shard/VRT directory: ",
      year_work_dir
    )
  }


  if (!cfg$keep_final_tif) {

    if (file.exists(
      final_tif
    )) {

      unlink(
        final_tif
      )


      log_message(
        "Removed local final TIFF after successful GCS upload + GRASS import."
      )
    }
  } else {

    log_message(
      "Keeping local final TIFF: ",
      final_tif
    )
  }


  invisible(TRUE)
}


# ------------------------------------------------------------------------------
# 19. EXECUTION
# ------------------------------------------------------------------------------

start_time <- Sys.time()


log_message(
  "INPUT PREFIX: gs://",
  cfg$bucket,
  "/",
  remote_year_prefix
)

log_message(
  "FINAL GCS: gs://",
  cfg$bucket,
  "/",
  remote_final_name
)

log_message(
  "LOCAL FINAL: ",
  final_tif
)

log_message(
  "GRASS LOCATION: ",
  location_path
)


# Build/reuse local annual mosaic.
if (
  !file.exists(
    final_tif
  ) ||
  cfg$rebuild_mosaic
) {

  local_shards <- log_step(
    "DOWNLOAD_SHARDS",
    download_shards()
  )


  log_step(
    "BUILD_MOSAIC",
    build_mosaic(
      local_shards
    )
  )

} else {

  log_message(
    "Local final TIFF already exists; reusing: ",
    final_tif
  )
}


# Validate final raster and the temporal master grid.
log_step(
  "VALIDATE_FINAL_AND_MASTER_GRID",
  validate_final_and_master()
)


# Upload final annual mosaic to GCS/nativeMask.
log_step(
  "UPLOAD_FINAL_TO_GCS",
  upload_final_mosaic()
)


# Import final categorical raster into independent annual GRASS Location.
log_step(
  "GRASS_INGESTION",
  ingest_into_grass()
)


# Remove source shards only after both upload and GRASS ingestion succeeded.
log_step(
  "CLEANUP",
  cleanup_after_success()
)


elapsed <- as.numeric(
  difftime(
    Sys.time(),
    start_time,
    units = "secs"
  )
)


log_message(
  "===== YEAR ",
  year,
  " SUCCESS | ",
  round(
    elapsed / 60,
    2
  ),
  " min ====="
)


write_status(
  state = "COMPLETED",
  current_step = "DONE",
  message = paste0(
    "Year completed successfully in ",
    round(elapsed / 60, 2),
    " min"
  )
)
