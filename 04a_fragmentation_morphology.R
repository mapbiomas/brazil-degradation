#!/usr/bin/env Rscript
# Run with:
# parallel -j 12 Rscript 03a_fragmentation_morphology.R ::: $(seq 1985 2024)

## clean temporaries
#BASE="/mnt/Files-Geo/Arquivos/DEGRADACAO/LSMETRICS/COL101/grassdata"
#find "$BASE" -maxdepth 3 -type d -path "$BASE/COL101_*/PERMANENT/.tmp" -print -exec rm -rf {} +

args <- commandArgs(trailingOnly = TRUE)
if (length(args) == 0) stop("Provide year")
year <- args[1]

suppressPackageStartupMessages({
  library(rgrass)
  library(lsmetrics)
})

# --------------------------------------------------
# LOGGING
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
  res <- tryCatch(expr, error = function(e) {
    log_message(paste("ERROR in", step, ":", e$message))
    stop(e)
  })
  log_message(paste("----", step, "END ----"))
  res
}

grass_has_raster <- function(name) {
  rasters <- execGRASS("g.list", parameters = list(type = "raster"), intern = TRUE)
  name %in% rasters
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
# GLOBAL SKIP
# --------------------------------------------------

if (file.exists(output_file) && file.info(output_file)$size > 1000) {
  log_message("Final GeoTIFF already exists. Skipping entire year.")
  quit(save = "no")
}

# --------------------------------------------------
# CREATE LOCATION
# --------------------------------------------------

log_step("CREATE_LOCATION", {
  if (!dir.exists(location_path)) {
    cmd <- sprintf("%s -c %s %s -e",
                   shQuote(grass_exec),
                   shQuote(input_raster),
                   shQuote(location_path))
    if (system(cmd) != 0) stop("Failed creating GRASS location")
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
# IMPORT RASTER
# --------------------------------------------------

existing_rasters <- execGRASS("g.list", parameters = list(type = "raster"), intern = TRUE)
if (!(grass_raster_name %in% existing_rasters)) {
  log_step("IMPORT_RASTER", {
    execGRASS("r.in.gdal", flags = c("overwrite", "o"),
              parameters = list(input = input_raster, output = grass_raster_name))
  })
} else {
  log_message("Raster already exists in GRASS. Skipping import.")
}

# --------------------------------------------------
# SET REGION
# --------------------------------------------------

log_step("SET_REGION", {
  execGRASS("g.region", parameters = list(raster = grass_raster_name, align = grass_raster_name))
})

# --------------------------------------------------
# MORPHOLOGY PIPELINE (FULL INLINE)
# --------------------------------------------------

base <- grass_raster_name
out  <- ""

r_null   <- paste0(base, out, "_morphological_segmentation_null")
r_bin    <- paste0(base, out, "_morphological_segmentation_binary")
r_id     <- paste0(base, out, "_morphological_segmentation_id")
r_matrix <- paste0(base, out, "_morphological_segmentation_matrix")
r_core   <- paste0(base, out, "_morphological_segmentation_core")
r_step   <- paste0(base, out, "_morphological_segmentation_stepping_stone")
r_edge   <- paste0(base, out, "_morphological_segmentation_edge")
r_bcp    <- paste0(base, out, "_morphological_segmentation_branch_corridor_perforation")
r_bcb    <- paste0(base, out, "_morphological_segmentation_branch_corridor_binary")
r_bcn    <- paste0(base, out, "_morphological_segmentation_branch_corridor_null")
r_bcid   <- paste0(base, out, "_morphological_segmentation_branch_corridor_id")
r_bcid_d <- paste0(base, out, "_morphological_segmentation_branch_corridor_id_dila")
r_patchb <- paste0(base, out, "_morphological_segmentation_patch_binary")
r_patchn <- paste0(base, out, "_morphological_segmentation_patch_null")
r_patchi <- paste0(base, out, "_morphological_segmentation_patch_id")
r_bcid_c <- paste0(base, out, "_morphological_segmentation_branch_corridor_id_dila_count")
r_bcid_a <- paste0(base, out, "_morphological_segmentation_branch_corridor_id_dila_count_adj")
r_perf   <- paste0(base, out, "_morphological_segmentation_perforation")
r_perf_d <- paste0(base, out, "_morphological_segmentation_perforation_dila")
r_corr   <- paste0(base, out, "_morphological_segmentation_corridor")
r_branch <- paste0(base, out, "_morphological_segmentation_branch")
r_final  <- paste0(base, out, "_morphological_segmentation")

if (!grass_has_raster(r_final)) {
  
  log_step("MORPH_NULL", {
    if (!grass_has_raster(r_null))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_null, " = if(", base, " == 1, 1, null())"))
  })
  
  log_step("MORPH_BINARY", {
    if (!grass_has_raster(r_bin))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_bin, " = ", base))
  })
  
  log_step("MORPH_CLUMP", {
    if (!grass_has_raster(r_id))
      execGRASS("r.clump", flags = c("d","quiet","overwrite"),
                input = r_null, output = r_id)
  })
  
  log_step("MORPH_MATRIX", {
    if (!grass_has_raster(r_matrix))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_matrix, " = if(", r_bin, " == 1, 0, 1)"))
  })
  
  log_step("MORPH_CORE", {
    if (!grass_has_raster(r_core))
      execGRASS("r.neighbors", flags = c("overwrite","quiet"),
                input = r_bin, selection = r_bin, output = r_core,
                size = 3, method = "min", nprocs = 1, memory = 8000)
  })
  
  log_step("MORPH_STEPPING_STONE", {
    if (!grass_has_raster(r_step)) {
      execGRASS("r.stats.zonal", flags = c("overwrite","quiet"),
                base = r_id, cover = r_core, method = "sum", output = r_step)
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_step, " = if(", r_step, " == 0, 1, null())"))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_step, " = if(isnull(", r_step, "), 0, 1)"))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_step, " = ", r_step, " * ", r_bin))
    }
  })
  
  log_step("MORPH_EDGE", {
    if (!grass_has_raster(r_edge)) {
      lsmetrics::lsm_aux_fill_hole(input = r_bin, zero_as_null = FALSE, nprocs = 1, memory = 8000)
      execGRASS("r.neighbors", flags = c("overwrite","quiet"),
                input = paste0(r_bin, "_aux_fill_hole"),
                selection = base,
                output = paste0(r_bin, "_fill_hole_contr"),
                size = 3, method = "min")
      execGRASS("r.neighbors", flags = c("overwrite","quiet"),
                input = paste0(r_bin, "_fill_hole_contr"),
                selection = base,
                output = r_patchb,
                size = 3, method = "max")
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_edge, " = if((",
                                    r_patchb, " - ",
                                    paste0(r_bin, "_fill_hole_contr"), " - ",
                                    r_step, ") > 0, 1, 0)"))
    }
  })
  
  log_step("MORPH_BCP", {
    if (!grass_has_raster(r_bcp))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_bcp, " = ",
                                    base, " - ",
                                    r_patchb, " - ",
                                    r_step))
  })
  
  log_step("MORPH_BC_BINARY", {
    if (!grass_has_raster(r_bcb))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_bcb, " = if(", r_bcp, " == 1, 1, 0)"))
  })
  
  log_step("MORPH_BC_NULL", {
    if (!grass_has_raster(r_bcn))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_bcn, " = if(", r_bcb, " == 1, 1, null())"))
  })
  
  log_step("MORPH_BC_CLUMP", {
    if (!grass_has_raster(r_bcid))
      execGRASS("r.clump", flags = c("d","quiet","overwrite"),
                input = r_bcn, output = r_bcid)
  })
  
  log_step("MORPH_BC_GROW", {
    if (!grass_has_raster(r_bcid_d)) {
      lsmetrics::lsm_aux_grow(flags = c("quiet","overwrite"),
                              input = r_bcid, output = r_bcid_d, metric = "maximum")
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_bcid_d, " = int(", r_bcid_d, ")"))
    }
  })
  
  log_step("MORPH_PATCH_NULL", {
    if (!grass_has_raster(r_patchn))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_patchn, " = if(", r_patchb, " == 1, 1, null())"))
  })
  
  log_step("MORPH_PATCH_CLUMP", {
    if (!grass_has_raster(r_patchi))
      execGRASS("r.clump", flags = c("d","quiet","overwrite"),
                input = r_patchn, output = r_patchi)
  })
  
  log_step("MORPH_BC_ZONAL", {
    if (!grass_has_raster(r_bcid_c))
      execGRASS("r.stats.zonal", flags = c("c","overwrite","quiet"),
                base = r_bcid_d, cover = r_patchi,
                method = "range", output = r_bcid_c)
  })
  
  log_step("MORPH_BC_ADJ", {
    if (!grass_has_raster(r_bcid_a))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_bcid_a, " = ", r_bcid_c, " * ", r_bcn))
  })
  
  log_step("MORPH_PERFORATION", {
    if (!grass_has_raster(r_perf)) {
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_perf, " = if(", r_bcp, " < 0, 1, 0)"))
      execGRASS("r.neighbors", flags = c("overwrite","quiet"),
                input = r_perf, selection = base, output = r_perf_d,
                size = 3, method = "max")
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_perf, " = ", r_perf_d, " * ", r_null))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_perf, " = ", r_perf, " - ", r_step, " - ", r_edge))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_perf, " = if(", r_perf, " == -1, 0, ", r_perf, ")"))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_perf, " = if(isnull(", r_perf, "), 0, ", r_perf, ")"))
    }
  })
  
  log_step("MORPH_CORRIDOR", {
    if (!grass_has_raster(r_corr)) {
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_corr, " = if(", r_bcid_a, " > 0, 1, null())"))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_corr, " = if(isnull(", r_corr, "), 0, 1)"))
    }
  })
  
  log_step("MORPH_BRANCH", {
    if (!grass_has_raster(r_branch)) {
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_branch, " = if(", r_bcid_a, " == 0, 1, null())"))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_branch, " = if(isnull(", r_branch, "), 0, 1)"))
    }
  })
  
  log_step("MORPH_FINAL", {
    if (!grass_has_raster(r_final))
      execGRASS("r.mapcalc", flags = c("overwrite","quiet"),
                expression = paste0(r_final, " = ",
                                    r_core, " * 1 + ",
                                    r_edge, " * 2 + ",
                                    r_corr, " * 3 + ",
                                    r_branch, " * 4 + ",
                                    r_step, " * 5 + ",
                                    r_perf, " * 6"))
  })
  
} else {
  log_message("Morphology already exists in GRASS. Skipping pipeline.")
}

# --------------------------------------------------
# EXPORT
# --------------------------------------------------

log_step("EXPORT", {
  execGRASS("r.out.gdal", flags = c("overwrite", "c"),
            parameters = list(input = r_final, output = output_file,
                              createopt = "COMPRESS=DEFLATE,BIGTIFF=YES"))
})

log_message(paste("===== FINISHED year", year, "SUCCESS ====="))
