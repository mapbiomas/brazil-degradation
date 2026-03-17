# ---- LIBRARIES ----
library(rgee)
library(progress)
library(parallel)

# ---- INITIALIZE EARTH ENGINE ----
ee_Initialize(project = "mapbiomas-mosaics")

# ---- CONFIG ----
tif_dir <- "./ssh_download/"
pattern_name <- "fragment_area"

# GCS
bucket_name <- "shared-development-storage"
prefix <- "AUXILIARES/DEGRADACAO/COL_101/fragment_area"
gcp_project <- "mapbiomas-mosaics"
bucket_location <- "US"

# EE collection
collection_id <- "projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/patch-size-all-v2"

# Upload parameters
pyr_policy <- "MODE"
nodata_value <- 0
overwrite <- FALSE

# Number of parallel workers
workers <- max(1, parallel::detectCores() - 1)

# ---- HELPERS ----

ensure_ic <- function(ic_id){
  
  ok <- TRUE
  
  tryCatch(
    ee$data$getAsset(ic_id),
    error=function(e) ok <<- FALSE
  )
  
  if(!ok){
    
    message("Creating ImageCollection: ",ic_id)
    
    system2(
      "earthengine",
      c("create","collection",ic_id),
      stdout=TRUE,
      stderr=TRUE
    )
    
  } else {
    
    message("Collection exists: ",ic_id)
    
  }
}

asset_from_path <- function(ic_id,tif){
  
  nm <- tools::file_path_sans_ext(basename(tif))
  nm <- gsub("[^A-Za-z0-9_\\-]","_",nm)
  
  paste0(ic_id,"/",nm)
}

asset_exists <- function(asset_id){
  
  exists <- TRUE
  
  tryCatch(
    ee$data$getAsset(asset_id),
    error=function(e) exists <<- FALSE
  )
  
  exists
}

bucket_exists <- function(bucket){
  
  res <- system2(
    "gsutil",
    c("ls","-b",paste0("gs://",bucket)),
    stdout=TRUE,
    stderr=TRUE
  )
  
  status <- attr(res,"status")
  
  is.null(status) || status == 0
}

ensure_bucket <- function(bucket,project,location="US"){
  
  if(bucket_exists(bucket)){
    
    message("Bucket exists: ",bucket)
    return()
    
  }
  
  message("Creating bucket: ",bucket)
  
  system2(
    "gsutil",
    c("mb","-p",project,"-l",location,paste0("gs://",bucket)),
    stdout=TRUE,
    stderr=TRUE
  )
}

build_gcs_path <- function(bucket,prefix,tif){
  
  paste0(
    "gs://",
    bucket,"/",
    prefix,"/",
    basename(tif)
  )
}

gcs_file_exists <- function(gcs_path){
  
  res <- system2(
    "gsutil",
    c("ls",gcs_path),
    stdout=TRUE,
    stderr=TRUE
  )
  
  status <- attr(res,"status")
  
  is.null(status) || status == 0
}

upload_to_gcs <- function(tif,gcs_path){
  
  if(gcs_file_exists(gcs_path)){
    
    message("GCS exists -> skip upload: ",gcs_path)
    return("skip_gcs")
    
  }
  
  message("Uploading to GCS: ",gcs_path)
  
  system2(
    "gsutil",
    c("-m","cp",tif,gcs_path),
    stdout=TRUE,
    stderr=TRUE
  )
  
  "uploaded_gcs"
}

start_ingestion <- function(gcs_path,asset_id){
  
  args <- c(
    "upload","image",
    paste0("--asset_id=",asset_id),
    paste0("--pyramiding_policy=",pyr_policy),
    paste0("--nodata_value=",nodata_value),
    gcs_path
  )
  
  system2(
    "earthengine",
    args,
    stdout=TRUE,
    stderr=TRUE
  )
  
  "task_started"
}

process_file <- function(tif){
  
  asset_id <- asset_from_path(collection_id,tif)
  
  if(asset_exists(asset_id) && !overwrite){
    
    return(list(
      tif=tif,
      action="skip_asset"
    ))
  }
  
  gcs_path <- build_gcs_path(bucket_name,prefix,tif)
  
  upload_status <- upload_to_gcs(tif,gcs_path)
  
  ingest_status <- start_ingestion(gcs_path,asset_id)
  
  list(
    tif=tif,
    gcs=gcs_path,
    asset=asset_id,
    upload=upload_status,
    ingest=ingest_status
  )
}

# ---- PREPARE ENVIRONMENT ----

ensure_ic(collection_id)
ensure_bucket(bucket_name,gcp_project,bucket_location)

# ---- FIND FILES ----

tifs <- list.files(
  tif_dir,
  pattern=pattern_name,
  full.names=TRUE
)

if(length(tifs)==0) stop("No tif files found")

# ---- PROGRESS BAR ----

pb <- progress_bar$new(
  format="Processing [:bar] :percent | :current/:total | eta: :eta",
  total=length(tifs),
  width=60
)

# ---- CLUSTER ----

cl <- makeCluster(workers)

clusterExport(
  cl,
  varlist=c(
    "collection_id","overwrite",
    "bucket_name","prefix",
    "pyr_policy","nodata_value",
    "asset_from_path","asset_exists",
    "build_gcs_path","upload_to_gcs",
    "start_ingestion","gcs_file_exists",
    "process_file"
  ),
  envir=environment()
)

# ---- PARALLEL PROCESSING ----

results <- list()

for(i in seq_along(tifs)){
  
  res <- parLapply(cl, list(tifs[i]), process_file)[[1]]
  
  results[[i]] <- res
  
  pb$tick()
  
}

stopCluster(cl)

# ---- CHECK COLLECTION ----

ic <- ee$ImageCollection(collection_id)

print(ic$size()$getInfo())
