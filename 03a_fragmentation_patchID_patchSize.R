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
# Parallel processing per year
# -------------------------------
ncores <- detectCores() - 1

mclapply(years, function(yr) {
  
  log_file <- file.path(logs_dir, paste0("fragment_id_", yr, ".log"))
  
  # Start log
  sink(log_file, append = TRUE)
  cat("===== Processing year:", yr, "=====\n")
  
  # Step 1: Import raster
  cat("Importing raster...\n")
  raster_file <- paste0("./tif/", prefix, yr, ".tif")
  rgrass::execGRASS(
    cmd = 'r.in.gdal',
    input = raster_file,
    output = paste0(prefix, yr)
  )
  cat("Raster imported.\n")
  
  # Step 2: Compute metric
  cat("Computing landscape metrics...\n")
  lsmetrics::lsm_area_fragment(
    input = paste0(prefix, yr),
    zero_as_null = FALSE,
    area_round_digit = 2,
    area_unit = 'ha',
    map_fragment_id = TRUE,
    map_fragment_ncell = FALSE,
    table_fragment_area = FALSE
  )
  cat("Metrics computed.\n")
  
  # Step 3: Export fragment ID
  cat("Exporting fragment ID...\n")
  rgrass::execGRASS("r.out.gdal",
                    flags = "overwrite",
                    input = paste0(prefix, yr, "_fragment_id"),
                    output = paste0(results_dir, "/fragment_id_", yr, ".tif"),
                    createopt = "COMPRESS=DEFLATE,TFW=YES,BIGTIFF=YES")
  cat("Fragment ID exported.\n")
  
  # Step 4: Export fragment area
  cat("Exporting fragment area...\n")
  rgrass::execGRASS("r.out.gdal",
                    flags = "overwrite",
                    input = paste0(prefix, yr, "_fragment_area"),
                    output = paste0(results_dir, "/fragment_area_", yr, ".tif"),
                    createopt = "COMPRESS=DEFLATE,TFW=YES,BIGTIFF=YES")
  cat("Fragment area exported.\n")
  
  cat("===== Finished year:", yr, "=====\n\n")
  
  # End log
  sink()
  
  return(paste("Completed", yr))
  
}, mc.cores = ncores)
