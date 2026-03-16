library(rgee)

ee_Initialize(project = "mapbiomas-mosaics")

# ---- CONFIG ----
tif_dir        <- "./ssh_download/"
pattern_name   <- "fragment_id"

# Separate bucket from folder-like prefix
bucket_name    <- "shared-development-storage"
prefix         <- "AUXILIARES/DEGRADACAO/COL_101/fragment_id"

# Needed only if bucket may need to be created
gcp_project    <- "mapbiomas-mosaics"

# Optional but recommended: choose a location explicitly
bucket_location <- "US"

collection_id  <- "projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/patch-id-v2"

pyr_policy     <- "MODE"
nodata_value   <- 0
overwrite      <- FALSE

# ---- HELPERS ----

ensure_ic <- function(ic_id) {
  ok <- TRUE
  tryCatch(
    { ee$data$getAsset(ic_id) },
    error = function(e) { ok <<- FALSE }
  )
  
  if (!ok) {
    message("Creating image collection: ", ic_id)
    status <- system2(
      "earthengine",
      c("create", "collection", ic_id),
      stdout = TRUE, stderr = TRUE
    )
    message(paste(status, collapse = "\n"))
  } else {
    message("Collection already exists: ", ic_id)
  }
}

asset_from_path <- function(ic_id, tif) {
  nm <- tools::file_path_sans_ext(basename(tif))
  nm <- gsub("[^A-Za-z0-9_\\-]", "_", nm)
  paste0(ic_id, "/", nm)
}

asset_exists <- function(asset_id) {
  exists <- TRUE
  tryCatch(
    { ee$data$getAsset(asset_id) },
    error = function(e) { exists <<- FALSE }
  )
  exists
}

bucket_exists <- function(bucket_name) {
  # gsutil ls -b gs://bucket
  res <- suppressWarnings(
    system2(
      "gsutil",
      c("ls", "-b", paste0("gs://", bucket_name)),
      stdout = TRUE,
      stderr = TRUE
    )
  )
  
  status <- attr(res, "status")
  is.null(status) || identical(status, 0L)
}

ensure_bucket <- function(bucket_name, gcp_project, location = "US") {
  if (bucket_exists(bucket_name)) {
    message("Bucket already exists: gs://", bucket_name)
    return(invisible(TRUE))
  }
  
  message("Bucket does not exist. Creating: gs://", bucket_name)
  
  # gsutil mb -p PROJECT -l LOCATION gs://bucket
  res <- system2(
    "gsutil",
    c("mb", "-p", gcp_project, "-l", location, paste0("gs://", bucket_name)),
    stdout = TRUE,
    stderr = TRUE
  )
  
  message(paste(res, collapse = "\n"))
  
  status <- attr(res, "status")
  if (!is.null(status) && status != 0L) {
    stop("Failed to create bucket gs://", bucket_name)
  }
  
  invisible(TRUE)
}

build_gcs_path <- function(bucket_name, prefix = NULL, tif) {
  prefix <- gsub("^/+", "", prefix %||% "")
  prefix <- gsub("/+$", "", prefix)
  
  if (nzchar(prefix)) {
    paste0("gs://", bucket_name, "/", prefix, "/", basename(tif))
  } else {
    paste0("gs://", bucket_name, "/", basename(tif))
  }
}

`%||%` <- function(x, y) if (is.null(x)) y else x

upload_one <- function(
    tif, asset_id, bucket_name, prefix = NULL,
    pyr = "MODE", nodata = NULL, overwrite = FALSE
) {
  gcs_path <- build_gcs_path(bucket_name, prefix, tif)
  
  message("Uploading to GCS: ", gcs_path)
  cp_res <- system2(
    "gsutil",
    c("cp", tif, gcs_path),
    stdout = TRUE,
    stderr = TRUE
  )
  message(paste(cp_res, collapse = "\n"))
  
  cp_status <- attr(cp_res, "status")
  if (!is.null(cp_status) && cp_status != 0L) {
    stop("Failed to copy to GCS: ", gcs_path)
  }
  
  args <- c(
    "upload", "image",
    paste0("--asset_id=", asset_id),
    paste0("--pyramiding_policy=", pyr)
  )
  
  if (!is.null(nodata)) {
    args <- c(args, paste0("--nodata_value=", nodata))
  }
  if (overwrite) {
    args <- c(args, "--force")
  }
  
  args <- c(args, gcs_path)
  
  message("-> Ingesting into EE: ", asset_id)
  ee_res <- system2(
    "earthengine",
    args,
    stdout = TRUE,
    stderr = TRUE
  )
  message(paste(ee_res, collapse = "\n"))
  
  ee_status <- attr(ee_res, "status")
  if (!is.null(ee_status) && ee_status != 0L) {
    stop("Failed EE ingestion for: ", asset_id)
  }
  
  invisible(gcs_path)
}

# ---- RUN ----
ensure_ic(collection_id)
ensure_bucket(bucket_name, gcp_project, bucket_location)

tifs <- list.files(
  tif_dir,
  pattern = pattern_name,
  full.names = TRUE,
  ignore.case = TRUE
)

if (length(tifs) == 0) {
  stop("No .tif files found in: ", tif_dir)
}

results <- lapply(tifs, function(tif) {
  asset_id <- asset_from_path(collection_id, tif)
  
  if (asset_exists(asset_id) && !overwrite) {
    msg <- sprintf("SKIP (exists): %s", asset_id)
    message(msg)
    return(list(tif = tif, asset_id = asset_id, action = "skip_exists"))
  }
  
  if (asset_exists(asset_id) && overwrite) {
    message("Overwriting existing asset: ", asset_id)
  }
  
  gcs_path <- upload_one(
    tif         = tif,
    asset_id    = asset_id,
    bucket_name = bucket_name,
    prefix      = prefix,
    pyr         = pyr_policy,
    nodata      = nodata_value,
    overwrite   = overwrite
  )
  
  list(
    tif = tif,
    gcs_path = gcs_path,
    asset_id = asset_id,
    action = "uploaded"
  )
})

ic <- ee$ImageCollection(collection_id)
print(ic$size()$getInfo())
