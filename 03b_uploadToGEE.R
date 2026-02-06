# ---- CONFIG ----
library(rgee)
ee_Initialize()  # needed to check/create the collection and use results

# Where your .tif files live
tif_dir       <- "./results/"
# Target ImageCollection (create if missing)
collection_id <- "users/<your_username>/my_collection"
# Upload options
pyr_policy    <- "MODE"     # use MODE for categorical, MEAN for continuous
nodata_value  <- 0
overwrite     <- FALSE      # TRUE to replace existing assets with same name

# ---- HELPERS ----

# 0) Ensure the collection exists (create if not)
ensure_ic <- function(ic_id) {
  ok <- TRUE
  tryCatch(
    { ee$data$getAsset(ic_id) },
    error = function(e) { ok <<- FALSE }
  )
  if (!ok) {
    message("Creating image collection: ", ic_id)
    status <- system2("earthengine", c("create", "collection", ic_id), stdout = TRUE, stderr = TRUE)
    message(paste(status, collapse = "\n"))
  } else {
    message("Collection already exists: ", ic_id)
  }
}

# 1) Build an asset id inside the collection from a tif path
asset_from_path <- function(ic_id, tif) {
  # strip extension; keep simple, safe name
  nm <- tools::file_path_sans_ext(basename(tif))
  # EE asset ids must avoid weird chars; replace spaces etc.
  nm <- gsub("[^A-Za-z0-9_\\-]", "_", nm)
  paste0(ic_id, "/", nm)
}

# 2) Check if an asset exists (TRUE/FALSE)
asset_exists <- function(asset_id) {
  exists <- TRUE
  tryCatch(
    { ee$data$getAsset(asset_id) },
    error = function(e) { exists <<- FALSE }
  )
  exists
}

# 3) Upload one tif via CLI
upload_one <- function(tif, asset_id, pyr = "MEAN", nodata = NULL, overwrite = FALSE) {
  args <- c(
    "upload", "image",
    paste0("--asset_id=", asset_id),
    paste0("--pyramiding_policy=", pyr)
  )
  if (!is.null(nodata)) args <- c(args, paste0("--nodata_value=", nodata))
  if (overwrite)        args <- c(args, "--force")
  args <- c(args, tif)
  
  message("-> Uploading: ", tif, "  ==>  ", asset_id)
  status <- system2("earthengine", args, stdout = TRUE, stderr = TRUE)
  # The CLI starts an ingestion task; it doesn't block. Log the CLI output:
  message(paste(status, collapse = "\n"))
}

# ---- RUN ----
ensure_ic(collection_id)

tifs <- list.files(tif_dir, pattern = "\\.tif(f)?$", full.names = TRUE, ignore.case = TRUE)
if (length(tifs) == 0) stop("No .tif files found in: ", tif_dir)

results <- lapply(tifs, function(tif) {
  asset_id <- asset_from_path(collection_id, tif)
  
  if (asset_exists(asset_id) && !overwrite) {
    msg <- sprintf("SKIP (exists): %s", asset_id)
    message(msg)
    return(list(tif = tif, asset_id = asset_id, action = "skip_exists"))
  }
  
  # If it exists and overwrite=TRUE, we'll force re-ingest
  if (asset_exists(asset_id) && overwrite) {
    message("Overwriting existing asset: ", asset_id)
  }
  
  upload_one(
    tif      = tif,
    asset_id = asset_id,
    pyr      = pyr_policy,
    nodata   = nodata_value,
    overwrite = overwrite
  )
  
  list(tif = tif, asset_id = asset_id, action = "uploaded")
})

# ---- AFTER STARTING TASKS ----
# You can watch progress from the CLI:
#   earthengine task list --verbose
# Or in the Code Editor > Tasks tab.

# Once all tasks finish, you can use the collection directly:
ic <- ee$ImageCollection(collection_id)
print(ic$size()$getInfo())
