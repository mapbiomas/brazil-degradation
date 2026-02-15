library(tidyverse)
library(terra)
library(lsmetrics)
library(parallel)
library(rgrass)

# -------------------------------
# Parameters
# -------------------------------
files <- list.files(path = "./tif", pattern = ".tif$", full.names = TRUE)
years <- seq(1985, 2024)
prefix <- 'nativeMask-classification_'

results_dir <- "./results"
logs_dir    <- "./logs"

dir.create(results_dir, showWarnings = FALSE)
dir.create(logs_dir, showWarnings = FALSE)  # Create logs folder

# GRASS path
path_grass <- system("grass --config path", intern = TRUE)

# Initialize GRASS DB (once)
r <- terra::rast(files[1])
rgrass::initGRASS(gisBase = path_grass,
                  SG = r,
                  gisDbase = "grassdb",
                  location = "newLocation",
                  mapset = "PERMANENT",
                  override = TRUE)

# -------------------------------
# Helper function to write timestamped messages
# -------------------------------
log_msg <- function(msg) {
  cat(format(Sys.time(), "%Y-%m-%d %H:%M:%S"), "-", msg, "\n")
}

# -------------------------------
# Parallel processing per year
# -------------------------------
ncores <- detectCores() - 1

mclapply(years, function(yr) {
  
  log_file <- file.path(logs_dir, paste0("fragment_id_", yr, ".log"))
  
  # Start log
  sink(log_file, append = TRUE)
  log_msg(paste("===== Processing year:", yr, "====="))
  
  # Step 1: Import raster
  log_msg("Importing raster...")
  raster_file <- paste0("./tif/", prefix, yr, ".tif")
  rgrass::execGRASS(
    cmd = 'r.in.gdal',
    input = raster_file,
    output = paste0(prefix, yr)
  )
  log_msg("Raster imported.")
  
  # Step 2: Compute metric
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
  log_msg("Exporting fragment ID...")
  rgrass::execGRASS("r.out.gdal",
                    flags = "overwrite",
                    input = paste0(prefix, yr, "_fragment_id"),
                    output = paste0(results_dir, "/fragment_id_", yr, ".tif"),
                    createopt = "COMPRESS=DEFLATE,TFW=YES,BIGTIFF=YES")
  log_msg("Fragment ID exported.")
  
  # Step 4: Export fragment area
  log_msg("Exporting fragment area...")
  rgrass::execGRASS("r.out.gdal",
                    flags = "overwrite",
                    input = paste0(prefix, yr, "_fragment_area"),
                    output = paste0(results_dir, "/fragment_area_", yr, ".tif"),
                    createopt = "COMPRESS=DEFLATE,TFW=YES,BIGTIFF=YES")
  log_msg("Fragment area exported.")
  
  log_msg(paste("===== Finished year:", yr, "====="))
  
  # End log
  sink()
  
  return(paste("Completed", yr))
  
}, mc.cores = ncores)
