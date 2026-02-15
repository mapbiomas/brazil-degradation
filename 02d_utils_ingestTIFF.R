## download tif from GCS to local drive
library(googleCloudStorageR)
library(parallel)

## load json key
gcs_auth("key.json")

## define gcs
bucket_name <- "shared-development-storage"

## output path
output <- "./tif/"
dir.create(output, showWarnings = FALSE, recursive = TRUE)

## list files
files <- gcs_list_objects(
  bucket = bucket_name,
  prefix = "AUXILIARES/DEGRADACAO/COL_101/nativeMask/"
)

## filter .tif
tif_files <- files$name[grepl("\\.tif$", files$name)]

## number of cores (be conservative for large rasters)
n_cores <- max(1, detectCores() - 1)

## parallel download
mclapply(
  tif_files,
  function(f) {
    
    # re-authenticate inside worker (safe practice)
    gcs_auth("mapbiomas-drc-0c17477b4f08.json")
    
    local_name <- basename(f)
    
    gcs_get_object(
      object_name = f,
      bucket = bucket_name,
      saveToDisk = file.path(output, local_name),
      overwrite = TRUE
    )
    
    cat("Downloaded:", local_name, "\n")
    
    return(local_name)
  },
  mc.cores = n_cores
)
