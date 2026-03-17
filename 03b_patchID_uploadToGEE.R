# =========================================
# HIGH-EFFICIENCY EE INGESTION PIPELINE
# =========================================

# ---- LIBRARIES ----
library(rgee)
library(jsonlite)

# ---- INITIALIZE EE ----
ee_Initialize(project = "mapbiomas-mosaics")

# ---- CONFIG ----
tif_dir <- "./ssh_download/"
pattern_name <- "fragment_id"

bucket_name <- "shared-development-storage"
prefix <- "AUXILIARES/DEGRADACAO/COL_101/fragment_id"

collection_id <- "projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/path-id-v2"

manifest_dir <- "./manifests"
dir.create(manifest_dir, showWarnings = FALSE)

pyr_policy <- "MODE"
nodata_value <- 0
overwrite <- FALSE

batch_size <- 50

# =========================================
# HELPERS
# =========================================

asset_from_path <- function(ic_id, tif){
  nm <- tools::file_path_sans_ext(basename(tif))
  nm <- gsub("[^A-Za-z0-9_\\-]", "_", nm)
  paste0(ic_id, "/", nm)
}

asset_exists <- function(asset_id){
  tryCatch({
    ee$data$getAsset(asset_id)
    TRUE
  }, error=function(e) FALSE)
}

gcs_uri_from_tif <- function(tif){
  paste0("gs://", bucket_name, "/", prefix, "/", basename(tif))
}

gcs_exists <- function(gcs_uri){
  res <- system2(
    "gsutil",
    c("ls", gcs_uri),
    stdout = TRUE,
    stderr = TRUE
  )
  status <- attr(res, "status")
  is.null(status) || status == 0
}

upload_if_needed <- function(tif, gcs_uri){
  
  if(gcs_exists(gcs_uri)){
    cat("✓ GCS exists -> skip:", gcs_uri, "\n")
    return("skip_gcs")
  }
  
  cat("↑ Uploading:", gcs_uri, "\n")
  
  system2(
    "gsutil",
    c("-m", "cp", tif, gcs_uri),
    stdout = TRUE,
    stderr = TRUE
  )
  
  return("uploaded")
}

build_manifest <- function(tif, asset_id, gcs_uri){
  
  list(
    name = asset_id,
    tilesets = list(
      list(
        sources = list(
          list(uris = list(gcs_uri))
        )
      )
    ),
    pyramidingPolicy = pyr_policy,
    missingData = list(value = nodata_value)
  )
}

# =========================================
# STEP 1 — LIST FILES
# =========================================

tifs <- list.files(
  tif_dir,
  pattern = pattern_name,
  full.names = TRUE
)

if(length(tifs) == 0) stop("No tif files found")

cat("Found", length(tifs), "files\n")

# =========================================
# STEP 2 — PROCESS FILES (SMART PIPELINE)
# =========================================

manifest_paths <- c()

for(tif in tifs){
  
  cat("\n-----------------------------\n")
  cat("Processing:", tif, "\n")
  
  asset_id <- asset_from_path(collection_id, tif)
  
  # ---- SKIP IF ASSET EXISTS ----
  if(asset_exists(asset_id) && !overwrite){
    cat("✓ EE asset exists -> skip:", asset_id, "\n")
    next
  }
  
  gcs_uri <- gcs_uri_from_tif(tif)
  
  # ---- UPLOAD IF NEEDED ----
  upload_if_needed(tif, gcs_uri)
  
  # ---- BUILD MANIFEST ----
  manifest <- build_manifest(tif, asset_id, gcs_uri)
  
  manifest_file <- file.path(
    manifest_dir,
    paste0(basename(tif), ".json")
  )
  
  write_json(
    manifest,
    manifest_file,
    auto_unbox = TRUE,
    pretty = TRUE
  )
  
  manifest_paths <- c(manifest_paths, manifest_file)
}

cat("\nManifests ready:", length(manifest_paths), "\n")

if(length(manifest_paths) == 0){
  cat("Nothing to ingest.\n")
  quit()
}

# =========================================
# STEP 3 — INGESTION (BATCHED)
# =========================================

cat("\n== STARTING INGESTION ==\n")

chunks <- split(
  manifest_paths,
  ceiling(seq_along(manifest_paths)/batch_size)
)

for(i in seq_along(chunks)){
  
  cat("\nBatch", i, "of", length(chunks), "\n")
  
  batch <- chunks[[i]]
  
  for(manifest in batch){
    
    cmd <- paste(
      "earthengine upload image --manifest",
      shQuote(manifest)
    )
    
    system(paste(cmd, "&"))
  }
  
  # throttle to avoid EE quota issues
  Sys.sleep(10)
}

cat("\nAll tasks submitted.\n")

# =========================================
# STEP 4 — CHECK COLLECTION
# =========================================

ic <- ee$ImageCollection(collection_id)

cat("\nCollection size:\n")
print(ic$size()$getInfo())
