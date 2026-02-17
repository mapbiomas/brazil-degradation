#!/usr/bin/env Rscript
# Run with:
# parallel -j 12 Rscript 03a_fragmentation_morphology.R ::: $(seq 1985 2024)

args <- commandArgs(trailingOnly = TRUE)
if (length(args) == 0) stop("Provide year")

year <- args[1]

suppressPackageStartupMessages({
  library(rgrass)
  library(lsmetrics)
})

# --------------------------------------------------
# LOGGING (ONE FILE PER YEAR)
# --------------------------------------------------

log_dir <- "logs"
dir.create(log_dir, recursive = TRUE, showWarnings = FALSE)

log_file <- file.path(log_dir, paste0("morphology_", year, ".log"))

log_message <- function(msg) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  line <- paste0("[", timestamp, "] ", msg, "\n")
  cat(line)
  cat(line, file = log_file, append = TRUE)
}

log_step <- function(step, expr) {
  log_message(paste("----", step, "START ----"))
  result <- tryCatch(
    expr,
    error = function(e) {
      log_message(paste("ERROR in", step, ":", e$message))
      stop(e)
    }
  )
  log_message(paste("----", step, "END ----"))
  result
}

log_message(paste("===== MORPHOLOGY year", year, "====="))

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

grass_exec <- Sys.which("grass")
if (grass_exec == "") stop("GRASS executable not found")

grass_path <- system("grass --config path", intern = TRUE)

gisDbase <- "./grassdata"
dir.create(gisDbase, recursive = TRUE, showWarnings = FALSE)

location_name <- paste0("COL101_", year)
location_path <- file.path(gisDbase, location_name)
mapset_name <- "PERMANENT"

input_raster <- paste0("./tif/nativeMask_classification_", year, ".tif")
grass_raster_name <- paste0("nativeMask_", year)

results_dir <- "./results"
dir.create(results_dir, recursive = TRUE, showWarnings = FALSE)

output_file <- file.path(results_dir, paste0("morphology_", year, ".tif"))

# --------------------------------------------------
# GLOBAL SKIP IF FINAL OUTPUT EXISTS
# --------------------------------------------------

if (file.exists(output_file) && file.info(output_file)$size > 1000) {
  log_message("Final GeoTIFF already exists. Skipping entire year.")
  quit(save = "no")
}

# --------------------------------------------------
# CREATE LOCATION (IF NEEDED)
# --------------------------------------------------

log_step("CREATE_LOCATION", {
  
  if (!dir.exists(location_path)) {
    
    cmd <- sprintf(
      "%s -c %s %s -e",
      shQuote(grass_exec),
      shQuote(input_raster),
      shQuote(location_path)
    )
    
    status <- system(cmd)
    if (status != 0) stop("Failed creating GRASS location")
  }
})

# --------------------------------------------------
# INIT GRASS
# --------------------------------------------------

log_step("INIT_GRASS", {
  
  initGRASS(
    gisBase  = grass_path,
    home     = tempdir(),
    gisDbase = gisDbase,
    location = location_name,
    mapset   = mapset_name,
    override = TRUE
  )
})

# --------------------------------------------------
# IMPORT RASTER (IF NOT PRESENT)
# --------------------------------------------------

existing_rasters <- execGRASS(
  "g.list",
  parameters = list(type = "raster"),
  intern = TRUE
)

if (!(grass_raster_name %in% existing_rasters)) {
  
  log_step("IMPORT_RASTER", {
    
    execGRASS(
      "r.in.gdal",
      flags = c("overwrite", "o"),
      parameters = list(
        input  = input_raster,
        output = grass_raster_name
      )
    )
  })
  
} else {
  log_message("Raster already exists in GRASS. Skipping import.")
}

# --------------------------------------------------
# SET REGION
# --------------------------------------------------

log_step("SET_REGION", {
  
  execGRASS(
    "g.region",
    parameters = list(
      raster = grass_raster_name,
      align  = grass_raster_name
    )
  )
})

# --------------------------------------------------
# CHECK IF MORPHOLOGY EXISTS
# --------------------------------------------------

final_raster <- paste0(grass_raster_name, "_morphological_segmentation")

existing_rasters <- execGRASS(
  "g.list",
  parameters = list(type = "raster"),
  intern = TRUE
)

morph_exists <- final_raster %in% existing_rasters

if (morph_exists) {
  log_message("Morphology raster already exists in GRASS. Skipping morphology.")
}

# --------------------------------------------------
# RUN LSM_MORPHOLOGY (IF NEEDED)
# --------------------------------------------------

if (!morph_exists) {
  
  log_step("LSM_MORPHOLOGY", {
    
    lsmetrics::lsm_landscape_morphology(
      input = grass_raster_name,
      zero_as_null = FALSE,
      region_input = FALSE,
      table_morphological_segmentation = FALSE,
      nprocs = 1,
      memory = 8000   # safe realistic value
    )
  })
  
} else {
  log_message("LSM_MORPHOLOGY skipped.")
}

# --------------------------------------------------
# EXPORT (IF NEEDED)
# --------------------------------------------------

if (!file.exists(output_file) || file.info(output_file)$size < 1000) {
  
  log_step("EXPORT", {
    
    execGRASS(
      "r.out.gdal",
      flags = c("overwrite", "c"),
      parameters = list(
        input     = final_raster,
        output    = output_file,
        createopt = "COMPRESS=DEFLATE,BIGTIFF=YES"
      )
    )
  })
  
} else {
  log_message("Export skipped (GeoTIFF already valid).")
}

# --------------------------------------------------
# CLEAN FINAL RASTER (OPTIONAL)
# --------------------------------------------------

log_step("CLEAN", {
  
  execGRASS(
    "g.remove",
    flags = c("f", "quiet"),
    parameters = list(
      type = "raster",
      name = final_raster
    )
  )
})

log_message(paste("===== FINISHED year", year, "SUCCESS ====="))
