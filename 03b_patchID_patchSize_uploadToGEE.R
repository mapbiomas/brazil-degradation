# ---- LIBRARIES ----
library(rgee)
library(progress)

# ---- INITIALIZE EARTH ENGINE ----
ee_Initialize(project = "mapbiomas-mosaics")

# ---- CONFIG ----
tif_dir <- "./ssh_download/"
pattern_name <- "fragment_id"

# GCS
bucket_name <- "shared-development-storage"
prefix <- "AUXILIARES/DEGRADACAO/COL_101/fragment_id"
gcp_project <- "mapbiomas-mosaics"
bucket_location <- "US"

# EE Collection
collection_id <- "projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/patch-id-v2"

# Upload parameters
pyr_policy <- "MODE"
nodata_value <- 0
overwrite <- FALSE


# ---- HELPERS ----

# Ensure ImageCollection exists
ensure_ic <- function(ic_id) {
  
  ok <- TRUE
  
  tryCatch(
    ee$data$getAsset(ic_id),
    error = function(e) ok <<- FALSE
  )
  
  if (!ok) {
    
    message("Creating image collection: ", ic_id)
    
    status <- system2(
      "earthengine",
      c("create", "collection", ic_id),
      stdout = TRUE,
      stderr = TRUE
    )
    
    message(paste(status, collapse = "\n"))
    
  } else {
    
    message("Collection already exists: ", ic_id)
    
  }
}


# Build asset id from filename
asset_from_path <- function(ic_id, tif) {
  
  nm <- tools::file_path_sans_ext(basename(tif))
  nm <- gsub("[^A-Za-z0-9_\\-]", "_", nm)
  
  paste0(ic_id, "/", nm)
  
}


# Check if EE asset exists
asset_exists <- function(asset_id) {
  
  exists <- TRUE
  
  tryCatch(
    ee$data$getAsset(asset_id),
    error = function(e) exists <<- FALSE
  )
  
  exists
}


# Check if bucket exists
bucket_exists <- function(bucket_name) {
  
  res <- suppressWarnings(
    system2(
      "gsutil",
      c("ls", "-b", paste0("gs://", bucket_name)),
      stdout = TRUE,
      stderr = TRUE
    )
  )
  
  status <- attr(res, "status")
  
  is.null(status) || status == 0
  
}


# Create bucket if missing
ensure_bucket <- function(bucket_name, gcp_project, location = "US") {
  
  if (bucket_exists(bucket_name)) {
    
    message("Bucket already exists: gs://", bucket_name)
    return(invisible(TRUE))
    
  }
  
  message("Creating bucket: gs://", bucket_name)
  
  res <- system2(
    "gsutil",
    c(
      "mb",
      "-p", gcp_project,
      "-l", location,
      paste0("gs://", bucket_name)
    ),
    stdout = TRUE,
    stderr = TRUE
  )
  
  message(paste(res, collapse = "\n"))
  
}


# Build GCS path
build_gcs_path <- function(bucket_name, prefix, tif) {
  
  paste0(
    "gs://",
    bucket_name,
    "/",
    prefix,
    "/",
    basename(tif)
  )
  
}


# Upload file to GCS and start EE ingestion
upload_one <- function(
    tif,
    asset_id,
    bucket_name,
    prefix,
    pyr = "MODE",
    nodata = NULL,
    overwrite = FALSE
) {
  
  gcs_path <- build_gcs_path(bucket_name, prefix, tif)
  
  message("\nUploading to GCS: ", gcs_path)
  
  system2(
    "gsutil",
    c("-m", "cp", tif, gcs_path),
    stdout = TRUE,
    stderr = TRUE
  )
  
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
  
  system2(
    "earthengine",
    args,
    stdout = TRUE,
    stderr = TRUE
  )
  
}


# ---- RUN PIPELINE ----

ensure_ic(collection_id)

ensure_bucket(
  bucket_name,
  gcp_project,
  bucket_location
)


# Find files
tifs <- list.files(
  tif_dir,
  pattern = pattern_name,
  full.names = TRUE,
  ignore.case = TRUE
)

if (length(tifs) == 0) {
  
  stop("No .tif files found in: ", tif_dir)
  
}


# ---- PROGRESS BAR ----

pb <- progress_bar$new(
  format = "Uploading [:bar] :percent | :current/:total | eta: :eta",
  total = length(tifs),
  clear = FALSE,
  width = 60
)


# ---- PROCESS FILES ----

results <- lapply(seq_along(tifs), function(i) {
  
  tif <- tifs[i]
  
  asset_id <- asset_from_path(collection_id, tif)
  
  if (asset_exists(asset_id) && !overwrite) {
    
    message("SKIP (exists): ", asset_id)
    
    pb$tick()
    
    return(list(
      tif = tif,
      asset_id = asset_id,
      action = "skip_exists"
    ))
    
  }
  
  upload_one(
    tif = tif,
    asset_id = asset_id,
    bucket_name = bucket_name,
    prefix = prefix,
    pyr = pyr_policy,
    nodata = nodata_value,
    overwrite = overwrite
  )
  
  pb$tick()
  
  list(
    tif = tif,
    asset_id = asset_id,
    action = "uploaded"
  )
  
})


# ---- CHECK COLLECTION ----

ic <- ee$ImageCollection(collection_id)

print(ic$size()$getInfo())
