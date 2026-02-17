#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)
if (length(args) == 0) stop("Provide year")

year <- args[1]

cat("===== Processing year:", year, "=====\n")

suppressPackageStartupMessages(library(rgrass))

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

grass_exec <- Sys.which("grass")
if (grass_exec == "") stop("GRASS executable not found in PATH")

grass_path <- system("grass --config path", intern = TRUE)

gisDbase <- "./grassdata"
dir.create(gisDbase, showWarnings = FALSE, recursive = TRUE)

location_name <- paste0("COL101_", year)
location_path <- file.path(gisDbase, location_name)
mapset_name   <- "PERMANENT"

input_raster <- paste0(
  "/mnt/Files-Geo/Arquivos/DEGRADACAO/LSMETRICS/COL101/tif/nativeMask_classification_",
  year,
  ".tif"
)

results_dir <- "./results"
dir.create(results_dir, showWarnings = FALSE, recursive = TRUE)

output_fragment_id   <- file.path(results_dir, paste0("fragment_id_", year, ".tif"))
output_fragment_area <- file.path(results_dir, paste0("fragment_area_", year, ".tif"))

# Skip if already processed
if (file.exists(output_fragment_id) && file.exists(output_fragment_area)) {
  cat("Outputs already exist. Skipping year", year, "\n")
  quit(save = "no")
}

# --------------------------------------------------
# CREATE LOCATION DIRECTLY FROM RASTER
# --------------------------------------------------

if (!dir.exists(location_path)) {
  
  cat("Creating GRASS location from raster...\n")
  
  cmd <- sprintf(
    "%s -c %s %s -e",
    shQuote(grass_exec),
    shQuote(input_raster),
    shQuote(location_path)
  )
  
  status <- system(cmd)
  
  if (status != 0) {
    stop("Failed to create GRASS location from raster")
  }
}

# --------------------------------------------------
# INIT GRASS
# --------------------------------------------------

initGRASS(
  gisBase  = grass_path,
  home     = tempdir(),
  gisDbase = gisDbase,
  location = location_name,
  mapset   = mapset_name,
  override = TRUE
)

cat("GRASS initialized\n")

# --------------------------------------------------
# IMPORT RASTER (override projection allowed)
# --------------------------------------------------

base_name   <- paste0("nativeMask_", year)
fragment    <- paste0(base_name, "_fragment")
fragment_id <- paste0(base_name, "_fragment_id")
area_cell   <- paste0(fragment, "_area_cell")
area_map    <- paste0(fragment, "_area")

cat("Importing raster...\n")

execGRASS(
  "r.in.gdal",
  flags = c("overwrite", "o"),
  parameters = list(
    input  = input_raster,
    output = base_name
  )
)

# Verify raster imported
rlist <- execGRASS(
  "g.list",
  parameters = list(type = "raster"),
  intern = TRUE
)

if (!(base_name %in% rlist)) {
  stop("Raster failed to import.")
}

cat("Raster imported successfully.\n")

# --------------------------------------------------
# FORCE REGION FROM RASTER
# --------------------------------------------------

cat("Setting computational region...\n")

execGRASS(
  "g.region",
  parameters = list(
    raster = base_name,
    align  = base_name
  )
)

# Print region for debug
execGRASS("g.region", flags = "p")

# --------------------------------------------------
# CREATE BINARY FRAGMENT MAP
# --------------------------------------------------

execGRASS(
  "r.mapcalc",
  flags = c("overwrite"),
  parameters = list(
    expression = sprintf(
      "%s = if(%s == 1, 1, null())",
      fragment, base_name
    )
  )
)

# --------------------------------------------------
# CLUMP PATCHES
# --------------------------------------------------

execGRASS(
  "r.clump",
  flags = c("overwrite"),
  parameters = list(
    input  = fragment,
    output = fragment_id
  )
)

# --------------------------------------------------
# APPLY MASK
# --------------------------------------------------

execGRASS(
  "r.mask",
  flags = c("overwrite"),
  parameters = list(raster = fragment)
)

# --------------------------------------------------
# CELL AREA (ha)
# --------------------------------------------------

execGRASS(
  "r.mapcalc",
  flags = c("overwrite"),
  parameters = list(
    expression = sprintf(
      "%s = area()/10000.0",
      area_cell
    )
  )
)

# --------------------------------------------------
# ZONAL SUM (patch size)
# --------------------------------------------------

execGRASS(
  "r.stats.zonal",
  flags = c("overwrite"),
  parameters = list(
    base   = fragment_id,
    cover  = area_cell,
    method = "sum",
    output = area_map
  )
)

# Round to integer hectares
execGRASS(
  "r.mapcalc",
  flags = c("overwrite"),
  parameters = list(
    expression = sprintf(
      "%s = int(%s)",
      area_map, area_map
    )
  )
)

# Remove mask
execGRASS("r.mask", flags = "r")

# --------------------------------------------------
# EXPORT RESULTS
# --------------------------------------------------

execGRASS(
  "r.out.gdal",
  flags = c("overwrite", "c"),
  parameters = list(
    input     = fragment_id,
    output    = output_fragment_id,
    type      = "Int32",
    createopt = "COMPRESS=DEFLATE,BIGTIFF=YES"
  )
)

execGRASS(
  "r.out.gdal",
  flags = c("overwrite", "c"),
  parameters = list(
    input     = area_map,
    output    = output_fragment_area,
    type      = "Int32",
    createopt = "COMPRESS=DEFLATE,BIGTIFF=YES"
  )
)

# --------------------------------------------------
# CLEAN TEMP RASTERS
# --------------------------------------------------

execGRASS(
  "g.remove",
  flags = c("f"),
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

cat("===== Finished year:", year, "=====\n")
