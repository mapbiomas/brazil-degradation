#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)
if (length(args) == 0) stop("Provide year")

year <- args[1]

cat("===== Processing year:", year, "=====\n")

library(rgrass)

# ----------------------------------
# SETTINGS
# ----------------------------------

grass_path <- system("grass --config path", intern = TRUE)
gisDbase   <- "./grassdata"

location_name <- "COL101"
mapset_name   <- paste0("year_", year)

input_raster <- paste0(
  "/mnt/Files-Geo/Arquivos/DEGRADACAO/LSMETRICS/COL101/tif/nativeMask_classification_",
  year,
  ".tif"
)

output_fragment_id   <- paste0("/mnt/results/fragment_id_", year, ".tif")
output_fragment_area <- paste0("/mnt/results/fragment_area_", year, ".tif")

# Skip if already processed
if (file.exists(output_fragment_id) && file.exists(output_fragment_area)) {
  cat("Outputs already exist. Skipping year", year, "\n")
  quit(save = "no")
}

# ----------------------------------
# INIT GRASS
# ----------------------------------

initGRASS(
  gisBase  = grass_path,
  home     = tempdir(),
  gisDbase = gisDbase,
  location = location_name,
  mapset   = mapset_name,
  override = TRUE
)

cat("GRASS initialized\n")

# ----------------------------------
# DEFINE MAP NAMES
# ----------------------------------

base_name   <- paste0("nativeMask_", year)
fragment    <- paste0(base_name, "_fragment")
fragment_id <- paste0(base_name, "_fragment_id")
area_cell   <- paste0(fragment, "_area_cell")
area_map    <- paste0(fragment, "_area")

# ----------------------------------
# IMPORT RASTER
# ----------------------------------

execGRASS(
  "r.in.gdal",
  flags = c("overwrite", "o"),   # -o ignores minor CRS differences
  parameters = list(
    input  = input_raster,
    output = base_name
  )
)

cat("Raster imported\n")

# ----------------------------------
# FRAGMENT BINARY
# ----------------------------------

execGRASS(
  "r.mapcalc",
  flags = c("overwrite", "quiet"),
  parameters = list(
    expression = sprintf(
      "%s = if(%s == 1, 1, null())",
      fragment, base_name
    )
  )
)

# ----------------------------------
# CLUMP (8 directions)
# ----------------------------------

execGRASS(
  "r.clump",
  flags = c("overwrite", "quiet", "d"),
  parameters = list(
    input  = fragment,
    output = fragment_id
  )
)

# ----------------------------------
# MASK
# ----------------------------------

execGRASS(
  "r.mask",
  flags = c("overwrite", "quiet"),
  parameters = list(raster = fragment)
)

# ----------------------------------
# CELL AREA (ha)
# ----------------------------------

execGRASS(
  "r.mapcalc",
  flags = "overwrite",
  parameters = list(
    expression = sprintf(
      "%s = area()/10000.0",
      area_cell
    )
  )
)

# ----------------------------------
# ZONAL SUM
# ----------------------------------

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

# Round area
execGRASS(
  "r.mapcalc",
  flags = "overwrite",
  parameters = list(
    expression = sprintf(
      "%s = int(%s)",
      area_map, area_map
    )
  )
)

# Remove mask
execGRASS("r.mask", flags = c("r", "quiet"))

# ----------------------------------
# EXPORT RESULTS
# ----------------------------------

execGRASS(
  "r.out.gdal",
  flags = "overwrite",
  parameters = list(
    input     = fragment_id,
    output    = output_fragment_id,
    createopt = "COMPRESS=DEFLATE,BIGTIFF=YES"
  )
)

execGRASS(
  "r.out.gdal",
  flags = "overwrite",
  parameters = list(
    input     = area_map,
    output    = output_fragment_area,
    createopt = "COMPRESS=DEFLATE,BIGTIFF=YES"
  )
)

cat("Export complete\n")

# ----------------------------------
# CLEAN INTERMEDIATE MAPS
# ----------------------------------

execGRASS(
  "g.remove",
  flags = c("f", "quiet"),
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
