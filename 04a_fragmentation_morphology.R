## compute landscape metrics for mapbiomas degradation working group 
## mauricio vancine // dhemerson conciani 
# prepare r ---------------------------------------------------------------

# install packages
#install.packages(c("remotes", "tidyverse", "terra"))
#remotes::install_github("mauriciovancine/lsmetrics", force = TRUE)

# packages
library(tidyverse)
library(terra)
library(lsmetrics)
library(parallel)

# list mapbiomas files
files <- list.files(path = "./tif", pattern = ".tif", full.names = TRUE)
years <- seq(1985, 2024)
prefix <- 'nativeMask_classification_'

## prepare grassdb ---------------------------------------------------------
# find grass
path_grass <- system("grass --config path", inter = TRUE) # windows users need to find the grass gis path installation, e.g. "C:/Program Files/GRASS GIS 8.3"

# import raster (only to initialize grassdb)
r <- terra::rast(files[1])
r

# create grassdb
rgrass::initGRASS(gisBase = path_grass,
                  SG = r,
                  gisDbase = "grassdb",
                  location = "newLocation",
                  mapset = "PERMANENT",
                  override = TRUE)

## import mapbiomas files to grassdb
mclapply(
  files,
  function(x) rgrass::execGRASS(
    cmd = 'r.in.gdal',
    input = x,
    output = sub('.tif$', '', basename(x))
  ),
  mc.cores = detectCores() - 1  # Use all but one core
)

## compute morphology
for (i in years) {  
  print(i)
  lsmetrics::lsm_morphology(
    input= paste0(prefix, i),
    zero_as_null = FALSE,
    memory = 1e13
  )
}

## export as GeoTIFF
for(i in years) {
  print(i)
  
  rgrass::execGRASS("r.out.gdal", 
                    flags = "overwrite",
                    input = paste0(prefix, i, "_morphology"),
                    output = paste0("./results/", "morphology_", i, ".tif"),
                    createopt = "COMPRESS=DEFLATE,TFW=YES,BIGTIFF=YES")
}

