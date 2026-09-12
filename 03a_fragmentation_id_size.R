#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 1L) stop("Usage: Rscript 03a_fragmentation_id_area.R <year>")

year <- suppressWarnings(as.integer(args[1]))
if (is.na(year) || year < 1985L || year > 2025L) {
  stop("Year must be between 1985 and 2025.")
}

suppressPackageStartupMessages({
  library(rgrass)
  library(jsonlite)
})

# ------------------------------------------------------------------
# ONE CPU THREAD PER YEAR
# ------------------------------------------------------------------

Sys.setenv(
  OMP_NUM_THREADS = "1",
  OPENBLAS_NUM_THREADS = "1",
  MKL_NUM_THREADS = "1",
  VECLIB_MAXIMUM_THREADS = "1",
  NUMEXPR_NUM_THREADS = "1",
  GDAL_NUM_THREADS = "1"
)

options(mc.cores = 1L)

# ------------------------------------------------------------------
# SETTINGS
# ------------------------------------------------------------------

`%||%` <- function(x, y) {
  if (is.null(x) || length(x) == 0L) y else x
}

env_bool <- function(name, default = FALSE) {
  x <- Sys.getenv(name, if (default) "true" else "false")
  tolower(x) %in% c("1", "true", "t", "yes", "y")
}

repo_root <- normalizePath(
  Sys.getenv("MB_REPO_ROOT", "."),
  mustWork = TRUE
)

gisDbase <- normalizePath(
  Sys.getenv(
    "MB_GRASSDB",
    file.path(repo_root, "grassdata")
  ),
  mustWork = TRUE
)

location_name <- paste0("COL11_", year)
location_path <- file.path(gisDbase, location_name)
mapset_name <- "PERMANENT"

if (!dir.exists(location_path)) {
  stop(
    paste0(
      "Missing GRASS Location: ",
      location_path,
      "\nRun 02b_ingestData first."
    )
  )
}

results_root <- Sys.getenv(
  "MB_ID_RESULTS_DIR",
  file.path(repo_root, "results", "id")
)

year_results_dir <- file.path(
  results_root,
  as.character(year)
)

dir.create(
  year_results_dir,
  recursive = TRUE,
  showWarnings = FALSE
)

log_root <- Sys.getenv(
  "MB_ID_LOG_DIR",
  file.path(repo_root, "logs", "id")
)

year_log_dir <- file.path(
  log_root,
  as.character(year)
)

dir.create(
  year_log_dir,
  recursive = TRUE,
  showWarnings = FALSE
)

log_file <- file.path(
  year_log_dir,
  "03a_fragmentation_id_area.log"
)

status_file <- file.path(
  year_log_dir,
  "status.json"
)

force_rebuild <- env_bool(
  "MB_REBUILD_ID",
  FALSE
)

grass_exec <- Sys.which("grass")
if (!nzchar(grass_exec)) stop("GRASS executable not found.")

grass_path <- system(
  "grass --config path",
  intern = TRUE
)[1]

# ------------------------------------------------------------------
# MAP / FILE NAMES
# ------------------------------------------------------------------

base_name <- paste0("nativeMask_", year)

binary_name <- paste0(
  "native_binary_",
  year
)

fragment_id_name <- paste0(
  "fragment_raw_id_",
  year
)

cell_area_name <- paste0(
  "fragment_cell_area_ha_",
  year
)

fragment_area_name <- paste0(
  "fragment_area_ha_",
  year
)

output_binary <- file.path(
  year_results_dir,
  paste0(binary_name, ".tif")
)

output_fragment_id <- file.path(
  year_results_dir,
  paste0(fragment_id_name, ".tif")
)

output_fragment_area <- file.path(
  year_results_dir,
  paste0(fragment_area_name, ".tif")
)

# ------------------------------------------------------------------
# LOG / STATUS
# ------------------------------------------------------------------

job_started_at <- Sys.time()
completed_steps <- character(0)

log_message <- function(...) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  line <- paste0(
    "[",
    timestamp,
    "] ",
    paste0(...),
    "\n"
  )

  cat(line)
  cat(
    line,
    file = log_file,
    append = TRUE
  )
}

write_status <- function(
  state,
  current_step = "",
  message = "",
  step_started_at = NA
) {

  payload <- list(
    year = year,
    pid = Sys.getpid(),
    state = state,
    current_step = current_step,
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
    message = message
  )

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

  if (!file.rename(tmp, status_file)) {
    file.copy(
      tmp,
      status_file,
      overwrite = TRUE
    )
    unlink(tmp)
  }

  invisible(payload)
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

      log_message(
        "ERROR in ",
        step,
        ": ",
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

  completed_steps <<- unique(
    c(
      completed_steps,
      step
    )
  )

  elapsed <- as.numeric(
    difftime(
      Sys.time(),
      t0,
      units = "secs"
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

# ------------------------------------------------------------------
# START / GRASS SESSION
# ------------------------------------------------------------------

log_message(
  "===== Processing year ",
  year,
  " ====="
)

log_message(
  "GRASS Location: ",
  location_path
)

log_message(
  "Results: ",
  year_results_dir
)

write_status(
  state = "RUNNING",
  current_step = "STARTING",
  message = "Annual fragmentation-ID worker started"
)

grass_home <- file.path(
  tempdir(),
  paste0(
    "grass_id_",
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

log_step("INIT_GRASS", {

  initGRASS(
    gisBase = grass_path,
    home = grass_home,
    gisDbase = gisDbase,
    location = location_name,
    mapset = mapset_name,
    override = TRUE
  )

})

# ------------------------------------------------------------------
# GRASS HELPERS
# ------------------------------------------------------------------

grass_rasters <- function() {
  x <- execGRASS(
    "g.list",
    parameters = list(
      type = "raster"
    ),
    intern = TRUE
  )

  trimws(x)
}

map_exists <- function(name) {
  name %in% grass_rasters()
}

remove_map_if_exists <- function(name) {

  if (map_exists(name)) {
    execGRASS(
      "g.remove",
      flags = c(
        "f",
        "quiet"
      ),
      parameters = list(
        type = "raster",
        name = name
      )
    )
  }

  invisible(TRUE)
}

validate_file <- function(path) {

  if (
    !file.exists(path) ||
    is.na(file.info(path)$size) ||
    file.info(path)$size <= 0
  ) {
    stop(
      paste0(
        "Missing or empty output: ",
        path
      )
    )
  }

  status <- system2(
    "gdalinfo",
    args = shQuote(path),
    stdout = FALSE,
    stderr = FALSE
  )

  if (status != 0L) {
    stop(
      paste0(
        "gdalinfo cannot read: ",
        path
      )
    )
  }

  invisible(TRUE)
}

# ------------------------------------------------------------------
# 01 CHECK INPUT
# ------------------------------------------------------------------

log_step("CHECK_INPUT", {

  if (!map_exists(base_name)) {
    stop(
      paste0(
        "Missing input GRASS raster: ",
        base_name,
        "\nExpected in ",
        location_name,
        "/",
        mapset_name
      )
    )
  }

})

# ------------------------------------------------------------------
# 02 SET REGION
# ------------------------------------------------------------------

log_step("SET_REGION", {

  execGRASS(
    "g.region",
    parameters = list(
      raster = base_name,
      align = base_name
    )
  )

})

# ------------------------------------------------------------------
# 03 CATEGORICAL -> BINARY
#
# All retained categorical classes are > 0.
# Outside the native/ignored reference is NULL.
# ------------------------------------------------------------------

log_step("CREATE_BINARY", {

  if (
    map_exists(binary_name) &&
    !force_rebuild
  ) {

    log_message(
      "Reusing GRASS raster: ",
      binary_name
    )

  } else {

    execGRASS(
      "r.mapcalc",
      flags = c(
        "overwrite",
        "quiet"
      ),
      parameters = list(
        expression = sprintf(
          "%s = if(%s > 0, 1, null())",
          binary_name,
          base_name
        )
      )
    )
  }

  if (!map_exists(binary_name)) {
    stop("Binary raster was not created.")
  }

})

# ------------------------------------------------------------------
# 04 CLUMP
#
# -d = Queen / 8-neighbour connectivity
# minsize=1 = retain one-cell fragments
#
# IDs produced here are RAW ANNUAL IDs, deliberately not temporal IDs.
# ------------------------------------------------------------------

log_step("CLUMP", {

  if (
    map_exists(fragment_id_name) &&
    !force_rebuild
  ) {

    log_message(
      "Reusing GRASS raster: ",
      fragment_id_name
    )

  } else {

    execGRASS(
      "r.clump",
      flags = c(
        "overwrite",
        "d",
        "quiet"
      ),
      parameters = list(
        input = binary_name,
        output = fragment_id_name,
        minsize = 1L
      )
    )
  }

  if (!map_exists(fragment_id_name)) {
    stop("Raw fragment-ID raster was not created.")
  }

})

# ------------------------------------------------------------------
# 05 CELL AREA
#
# No GRASS MASK is used. This avoids leaving a persistent MASK behind
# if a worker crashes.
# ------------------------------------------------------------------

log_step("CELL_AREA", {

  execGRASS(
    "r.mapcalc",
    flags = c(
      "overwrite",
      "quiet"
    ),
    parameters = list(
      expression = sprintf(
        "%s = if(!isnull(%s), area()/10000.0, null())",
        cell_area_name,
        fragment_id_name
      )
    )
  )

  if (!map_exists(cell_area_name)) {
    stop("Cell-area raster was not created.")
  }

})

# ------------------------------------------------------------------
# 06 PATCH AREA
#
# IMPORTANT: keep floating-point hectares.
# Do NOT convert to int().
# ------------------------------------------------------------------

log_step("ZONAL_SUM", {

  if (
    map_exists(fragment_area_name) &&
    !force_rebuild
  ) {

    log_message(
      "Reusing GRASS raster: ",
      fragment_area_name
    )

  } else {

    execGRASS(
      "r.stats.zonal",
      flags = c(
        "overwrite",
        "quiet"
      ),
      parameters = list(
        base = fragment_id_name,
        cover = cell_area_name,
        method = "sum",
        output = fragment_area_name
      )
    )
  }

  if (!map_exists(fragment_area_name)) {
    stop("Fragment-area raster was not created.")
  }

})

# ------------------------------------------------------------------
# 07 EXPORT OPTIONS
# ------------------------------------------------------------------

createopt_integer <- paste(
  c(
    "TILED=YES",
    "BLOCKXSIZE=512",
    "BLOCKYSIZE=512",
    "COMPRESS=ZSTD",
    "ZSTD_LEVEL=9",
    "PREDICTOR=2",
    "NUM_THREADS=1",
    "BIGTIFF=IF_SAFER"
  ),
  collapse = ","
)

createopt_float <- paste(
  c(
    "TILED=YES",
    "BLOCKXSIZE=512",
    "BLOCKYSIZE=512",
    "COMPRESS=ZSTD",
    "ZSTD_LEVEL=9",
    "PREDICTOR=3",
    "NUM_THREADS=1",
    "BIGTIFF=IF_SAFER"
  ),
  collapse = ","
)

# ------------------------------------------------------------------
# 08 EXPORT BINARY
# ------------------------------------------------------------------

log_step("EXPORT_BINARY", {

  if (
    file.exists(output_binary) &&
    !force_rebuild
  ) {

    log_message(
      "Reusing output: ",
      output_binary
    )

  } else {

    execGRASS(
      "r.out.gdal",
      flags = c(
        "overwrite",
        "c",
        "quiet"
      ),
      parameters = list(
        input = binary_name,
        output = output_binary,
        format = "GTiff",
        type = "Byte",
        createopt = createopt_integer
      )
    )
  }

  validate_file(output_binary)

})

# ------------------------------------------------------------------
# 09 EXPORT RAW IDs
# ------------------------------------------------------------------

log_step("EXPORT_ID", {

  if (
    file.exists(output_fragment_id) &&
    !force_rebuild
  ) {

    log_message(
      "Reusing output: ",
      output_fragment_id
    )

  } else {

    execGRASS(
      "r.out.gdal",
      flags = c(
        "overwrite",
        "c",
        "quiet"
      ),
      parameters = list(
        input = fragment_id_name,
        output = output_fragment_id,
        format = "GTiff",
        type = "Int32",
        createopt = createopt_integer
      )
    )
  }

  validate_file(output_fragment_id)

})

# ------------------------------------------------------------------
# 10 EXPORT AREA
# ------------------------------------------------------------------

log_step("EXPORT_AREA", {

  if (
    file.exists(output_fragment_area) &&
    !force_rebuild
  ) {

    log_message(
      "Reusing output: ",
      output_fragment_area
    )

  } else {

    execGRASS(
      "r.out.gdal",
      flags = c(
        "overwrite",
        "c",
        "quiet"
      ),
      parameters = list(
        input = fragment_area_name,
        output = output_fragment_area,
        format = "GTiff",
        type = "Float64",
        createopt = createopt_float
      )
    )
  }

  validate_file(output_fragment_area)

})

# ------------------------------------------------------------------
# 11 FINAL VALIDATION
# ------------------------------------------------------------------

log_step("VALIDATE_OUTPUTS", {

  required_maps <- c(
    binary_name,
    fragment_id_name,
    fragment_area_name
  )

  missing_maps <- required_maps[
    !vapply(
      required_maps,
      map_exists,
      logical(1)
    )
  ]

  if (length(missing_maps)) {
    stop(
      paste0(
        "Missing persistent GRASS maps: ",
        paste(
          missing_maps,
          collapse = ", "
        )
      )
    )
  }

  validate_file(output_binary)
  validate_file(output_fragment_id)
  validate_file(output_fragment_area)

})

# ------------------------------------------------------------------
# 12 CLEAN TEMP ONLY
#
# KEEP:
#   nativeMask_YYYY
#   native_binary_YYYY
#   fragment_raw_id_YYYY
#   fragment_area_ha_YYYY
#
# REMOVE:
#   fragment_cell_area_ha_YYYY
# ------------------------------------------------------------------

log_step("CLEANUP_TEMP", {

  remove_map_if_exists(
    cell_area_name
  )

})

# ------------------------------------------------------------------
# SUCCESS
# ------------------------------------------------------------------

elapsed <- as.numeric(
  difftime(
    Sys.time(),
    job_started_at,
    units = "secs"
  )
)

log_message(
  "===== Finished year ",
  year,
  " SUCCESS in ",
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
    round(
      elapsed / 60,
      2
    ),
    " min"
  )
)
