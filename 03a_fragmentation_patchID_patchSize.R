library(tidyverse)
library(terra)
library(lsmetrics)
library(parallel)
library(rgrass)
library(future.apply)

# -------------------------------
# Parameters
# -------------------------------
input_dir <- './tif'
prefix <- 'nativeMask_classification_'
years <- seq(1985, 2024)

results_dir <- file.path(getwd(), "results")
logs_dir    <- file.path(getwd(), "logs")
input_dir   <- file.path(getwd(), "tif")

dir.create(results_dir, showWarnings = FALSE)
dir.create(logs_dir, showWarnings = FALSE)  # Create logs folder

## Initialize GRASS 
path_grass <- system("grass --config path", intern = TRUE)

## pre-create GRASS files for each worker (avoids i/o errors) 
for (yr in years) {
  
  gisDbase <- file.path(getwd(), "grassdb", paste0("year_", yr))
  dir.create(gisDbase, recursive = TRUE, showWarnings = FALSE)
  
  rgrass::initGRASS(
    gisBase = path_grass,
    SG = terra::rast(file.path(input_dir, paste0(prefix, yr, ".tif"))),
    gisDbase = gisDbase,
    location = "location",
    mapset = "PERMANENT",
    override = TRUE
  )
  
}


## setup parallel sessions
plan(multisession, workers = 10)

# -------------------------------
# Helper function to write timestamped messages
# -------------------------------
log_msg <- function(msg) {
  cat(format(Sys.time(), "%Y-%m-%d %H:%M:%S"), "-", msg, "\n")
}

# -------------------------------
# Helper function to write timestamped messages
# -------------------------------
results <- future_lapply(years, function(yr) {
  
  log_file <- file.path(logs_dir, paste0("fragment_id_", yr, ".log"))
  
  # Start log
  sink(log_file, append = TRUE)
  log_msg(paste("===== Processing year:", yr, "====="))
  
  raster_file <- paste0(input_dir, '/', prefix, yr, '.tif')
  
  gisDbase <- file.path("grassdb", paste0("year_", yr))
  dir.create(gisDbase, recursive = TRUE, showWarnings = FALSE)
  
  Sys.sleep(runif(1, 1, 10))
  # Step 1: Import raster
  log_msg("Starting GRASS GIS")
  
  # Initialize GRASS DB inside workers with independent mapsets 
  rgrass::initGRASS(gisBase = path_grass,
                    gisDbase = gisDbase,
                    location = 'location',
                    mapset = "PERMANENT",
                    override = TRUE)
  
  ## Import raster
  log_msg("Importing raster file...")
  rgrass::execGRASS(
    cmd = 'r.in.gdal',
    input = raster_file,
    output = paste0(prefix, yr)
  )
  
  # Compute metric (aid and area)
  log_msg("Computing landscape metrics...")
  lsmetrics::lsm_area_fragment(
    input = paste0(prefix, yr),
    zero_as_null = FALSE,
    area_round_digit = 2,
    area_unit = 'ha',
    map_fragment_id = TRUE,
    map_fragment_ncell = TRUE,
    table_fragment_area = FALSE
  )
  
  log_msg("Metrics computed.")
  
  # Step 3: Export fragment ID
  log_msg("Exporting fragment ID./ GeoTIFF...")
  rgrass::execGRASS(
    "r.out.gdal",
    flags = "overwrite",
    input = paste0(prefix, yr, "_fragment_id"),
    output = paste0(results_dir, "/fragment_id_", yr, ".tif"),
    createopt = "COMPRESS=DEFLATE,TFW=YES,BIGTIFF=YES"
  )
  log_msg("Fragment ID exported.")
  
  # Step 4: Export fragment area
  log_msg("Exporting fragment area GeoTIFF...")
  rgrass::execGRASS(
    "r.out.gdal",
    flags = "overwrite",
    input = paste0(prefix, yr, "_fragment_area"),
    output = paste0(results_dir, "/fragment_area_", yr, ".tif"),
    createopt = "COMPRESS=DEFLATE,TFW=YES,BIGTIFF=YES"
  )
  log_msg("Fragment area exported.")
  
  log_msg(paste("===== Finished year:", yr, "====="))
  
  # End log
  sink()
  
  return(paste("Completed", yr))
  
}, future.seed= TRUE)
