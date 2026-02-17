#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)
if (length(args) == 0) stop("Provide year")

year <- args[1]

suppressPackageStartupMessages(library(rgrass))

# --------------------------------------------------
# LOG SETUP (ONE FILE PER YEAR)
# --------------------------------------------------

log_dir <- "logs"
dir.create(log_dir, recursive = TRUE, showWarnings = FALSE)

log_file <- file.path(log_dir, paste0(year, ".log"))

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
  return(result)
}

log_message(paste("===== Processing year", year, "====="))

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

grass_exec <- Sys.which("grass")
if (grass_exec == "") stop("GRASS executable not found")

grass_path <- system("grass --config path", intern = TRUE)

gisDbase <- "./grassdata"
dir.create(gisDbase, showWarnings = FALSE, recursive = TRUE)

location_name <- paste0("COL101_", year)
location_path <- file.path(gisDbase, location_name)
mapset_name   <- "PERMANENT"

input_raster <- paste0("./tif/nativeMask_classification_", year, ".tif")

results_dir <- "./results"
dir.create(results_dir, showWarnings = FALSE, recursive = TRUE)

output_fragment_id   <- file.path(results_dir, paste0("fragment_id_", year, ".tif"))
output_fragment_area <- file.path(results_dir, paste0("fragment_area_", year, ".tif"))

if (file.exists(output_fragment_id) && file.exists(output_fragment_area)) {
  log_message("Outputs already exist. Skipping year.")
  quit(save = "no")
}

# --------------------------------------------------
# 01 CREATE LOCATION
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
# 02 INIT GRASS
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
# 03 IMPORT RASTER
# --------------------------------------------------

base_name   <- paste0("nativeMask_", year)
fragment    <- paste0(base_name, "_fragment")
fragment_id <- paste0(base_name, "_fragment_id")
area_cell   <- paste0(fragment, "_area_cell")
area_map    <- paste0(fragment, "_area")

log_step("IMPORT_RASTER", {
  
  execGRASS(
    "r.in.gdal",
    flags = c("overwrite", "o"),
    parameters = list(
      input  = input_raster,
      output = base_name
    )
  )
  
  rlist <- execGRASS(
    "g.list",
    parameters = list(type = "raster"),
    intern = TRUE
  )
  
  if (!(base_name %in% rlist))
    stop("Raster import failed")
  
})

# --------------------------------------------------
# 04 SET REGION
# --------------------------------------------------

log_step("SET_REGION", {
  
  execGRASS(
    "g.region",
    parameters = list(
      raster = base_name,
      align  = base_name
    )
  )
  
})

# --------------------------------------------------
# 05 CREATE BINARY
# --------------------------------------------------

log_step("CREATE_BINARY", {
  
  execGRASS(
    "r.mapcalc",
    flags = "overwrite",
    parameters = list(
      expression = sprintf(
        "%s = if(%s == 1, 1, null())",
        fragment, base_name
      )
    )
  )
  
})

# --------------------------------------------------
# 06 CLUMP
# --------------------------------------------------

log_step("CLUMP", {
  
  execGRASS(
    "r.clump",
    flags = "overwrite",
    parameters = list(
      input  = fragment,
      output = fragment_id
    )
  )
  
})

# --------------------------------------------------
# 07 MASK
# --------------------------------------------------

log_step("MASK", {
  
  execGRASS(
    "r.mask",
    flags = "overwrite",
    parameters = list(raster = fragment)
  )
  
})

# --------------------------------------------------
# 08 CELL AREA
# --------------------------------------------------

log_step("CELL_AREA", {
  
  execGRASS(
    "r.mapcalc",
    flags = "overwrite",
    parameters = list(
      expression = sprintf("%s = area()/10000.0", area_cell)
    )
  )
  
})

# --------------------------------------------------
# 09 ZONAL SUM
# --------------------------------------------------

log_step("ZONAL_SUM", {
  
  execGRASS(
    "r.stats.zonal",
    flags = "overwrite",
    parameters = list(
      base   = fragment_id,
      cover  = area_cell,
      method = "sum",
      output = area_map
    )
  )
  
  execGRASS(
    "r.mapcalc",
    flags = "overwrite",
    parameters = list(
      expression = sprintf("%s = int(%s)", area_map, area_map)
    )
  )
  
})

# --------------------------------------------------
# 10 REMOVE MASK
# --------------------------------------------------

log_step("REMOVE_MASK", {
  execGRASS("r.mask", flags = "r")
})

# --------------------------------------------------
# 11 EXPORT
# --------------------------------------------------

log_step("EXPORT", {
  
  execGRASS(
    "r.out.gdal",
    flags = c("overwrite", "c"),
    parameters = list(
      input     = fragment_id,
      output    = output_fragment_id,
      createopt = "COMPRESS=DEFLATE,BIGTIFF=YES"
    )
  )
  
  execGRASS(
    "r.out.gdal",
    flags = c("overwrite", "c"),
    parameters = list(
      input     = area_map,
      output    = output_fragment_area,
      createopt = "COMPRESS=DEFLATE,BIGTIFF=YES"
    )
  )
  
})

# --------------------------------------------------
# 12 CLEAN
# --------------------------------------------------

log_step("CLEANUP", {
  
  execGRASS(
    "g.remove",
    flags = "f",
    parameters = list(
      type = "raster",
      name = paste(
        base_name,
        fragment,
        fragment_id,
        area_cell,
        area_map,
        sep = ","
      )
    )
  )
  
})

log_message(paste("===== Finished year", year, "SUCCESS ====="))

# parallel -j 12 Rscript 03a_year.R ::: $(seq 1985 2024)
