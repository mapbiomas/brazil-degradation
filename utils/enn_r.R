# ============================================================
# FAST ENN per tile — PSOCK SAFE + MULTI-YEAR + LOGGING
# ============================================================

suppressPackageStartupMessages({
  library(parallel)
})

# -----------------------------
# USER PARAMETERS
# -----------------------------
years <- c(1985, 2024)

searchRadius_m <- 20000
#n_cores <- max(1, parallel::detectCores() - 1)
n_cores <- 17

patch_path_template <- "./results/fragment_id_%d.tif"
grid_path <- "./hex/degradation-fragmentation-enn-tiles.shp"

out_dir <- "enn_tiles"
log_dir <- file.path(out_dir, "logs")

k0 <- 256
k_max <- 512
chunk_size <- 200000
thin_step <- 1

dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(log_dir, showWarnings = FALSE, recursive = TRUE)

ts <- function() format(Sys.time(), "%Y-%m-%d %H:%M:%S")

# -----------------------------
# WORKER FUNCTION
# -----------------------------
enn_worker <- function(i, year,
                       patch_path_template, grid_path,
                       searchRadius_m, out_dir, log_dir,
                       k0, k_max, chunk_size, thin_step) {
  
  suppressPackageStartupMessages({
    library(terra)
    library(RANN)
    library(data.table)
  })
  
  log_path <- file.path(
    log_dir,
    sprintf("tile_i%05d_%d.log", i, year)
  )
  
  logf <- function(...) {
    cat(sprintf("[%s] %s\n",
                format(Sys.time(), "%Y-%m-%d %H:%M:%S"),
                paste(..., collapse = "")),
        file = log_path, append = TRUE)
  }
  
  logf("===== TILE START =====")
  
  meters_to_deg <- function(m, lat_deg) {
    lat_rad <- lat_deg * pi / 180
    m_per_deg_lat <- 111132.92 - 559.82*cos(2*lat_rad) + 1.175*cos(4*lat_rad)
    m_per_deg_lon <- 111412.84*cos(lat_rad) - 93.5*cos(3*lat_rad)
    m / pmin(m_per_deg_lat, m_per_deg_lon)
  }
  
  lonlat_to_local_m <- function(lon, lat, lat0_deg) {
    lat0 <- lat0_deg * pi / 180
    m_per_deg_lat <- 111132.92 - 559.82*cos(2*lat0) + 1.175*cos(4*lat0)
    m_per_deg_lon <- 111412.84*cos(lat0) - 93.5*cos(3*lat0)
    cbind(lon * m_per_deg_lon, lat * m_per_deg_lat)
  }
  
  first_diff_dist <- function(nn_idx, nn_d, pid_query, pid_all) {
    nbr_pid <- matrix(pid_all[nn_idx], nrow = nrow(nn_idx))
    ok <- nbr_pid != pid_query
    first <- max.col(ok, ties.method = "first")
    has <- rowSums(ok) > 0
    out <- rep(NA_real_, nrow(nn_idx))
    out[has] <- nn_d[cbind(which(has), first[has])]
    out
  }
  
  patch <- rast(sprintf(patch_path_template, year))
  grid <- vect(grid_path)
  
  tile <- grid[i]
  fid <- if ("FID" %in% names(tile)) tile$FID else i
  
  out_file <- file.path(out_dir, paste0("ENN_", fid, "_", year, ".tif"))
  
  if (file.exists(out_file)) {
    logf("Output exists → skipping")
    return(TRUE)
  }
  
  cent <- crds(centroids(project(tile, "EPSG:4326")), df = TRUE)
  lat0 <- cent[1, 2]
  deg_buf <- meters_to_deg(searchRadius_m, lat0)
  
  logf("Centroid lat=", round(lat0, 4),
       " deg_buf=", signif(deg_buf, 4))
  
  tile_ll <- project(tile, crs(patch))
  tile_buf <- buffer(tile_ll, deg_buf)
  
  r <- try(crop(patch, tile_buf), silent = TRUE)
  if (inherits(r, "try-error") || ncell(r) == 0) {
    logf("Empty crop → writing NA raster")
    rr <- mask(crop(patch[[1]], tile_ll), tile_ll)
    writeRaster(rr * NA, out_file, overwrite = TRUE)
    return(TRUE)
  }
  
  r <- mask(r, tile_buf)
  
  bnd <- boundaries(r, inner = TRUE)
  bnd_id <- mask(r, bnd == 1)
  
  v <- values(bnd_id)
  cells <- which(!is.na(v))
  
  if (length(cells) == 0) {
    logf("No boundary cells → writing NA raster")
    rr <- mask(crop(r, tile_ll), tile_ll)
    writeRaster(rr * NA, out_file, overwrite = TRUE)
    return(TRUE)
  }
  
  pid_all <- v[cells]
  n_pid <- length(unique(pid_all))
  
  logf("Boundary cells=", length(cells),
       " unique fragments=", n_pid)
  
  # -----------------------------
  # SINGLE FRAGMENT CASE
  # -----------------------------
  if (n_pid == 1) {
    logf("Single fragment in tile → ENN = 60 everywhere")
    rr <- mask(crop(r, tile_ll), tile_ll)
    rr[!is.na(rr)] <- 60
    writeRaster(rr, out_file, overwrite = TRUE)
    logf("Tile done (single-fragment)")
    return(TRUE)
  }
  
  xy_ll <- xyFromCell(bnd_id, cells)
  xy_m <- lonlat_to_local_m(xy_ll[,1], xy_ll[,2], lat0)
  
  dmin <- rep(NA_real_, length(pid_all))
  unresolved <- seq_along(dmin)
  k <- k0
  iter <- 1
  
  while (length(unresolved) > 0 && k <= k_max) {
    logf("KD round ", iter,
         " unresolved=", length(unresolved),
         " k=", k)
    
    for (s in seq(1, length(unresolved), by = chunk_size)) {
      idx <- unresolved[s:min(s + chunk_size - 1, length(unresolved))]
      nn <- nn2(xy_m, xy_m[idx,,drop = FALSE], k = k)
      dmin[idx] <- first_diff_dist(nn$nn.idx, nn$nn.dists,
                                   pid_all[idx], pid_all)
    }
    
    unresolved <- which(is.na(dmin))
    k <- k * 2
    iter <- iter + 1
  }
  
  dt <- data.table(pid = pid_all, d = dmin)
  enn_by_pid <- dt[!is.na(d), .(enn_m = min(d)), by = pid]
  
  logf("Fragments with ENN=", nrow(enn_by_pid))
  
  if (nrow(enn_by_pid) == 0) {
    logf("No ENN found → writing NA raster")
    rr <- mask(crop(r, tile_ll), tile_ll)
    writeRaster(rr * NA, out_file, overwrite = TRUE)
    return(TRUE)
  }
  
  enn_r <- classify(r, as.matrix(enn_by_pid), others = NA)
  enn_tile <- mask(crop(enn_r, tile_ll), tile_ll)
  
  # round to integer meters
  enn_tile <- round(enn_tile, 0)
  
  # write as uint16
  writeRaster(
    enn_tile,
    out_file,
    overwrite = TRUE,
    datatype = "UINT16",
    NAflag= 0
  )
  
  logf("Tile done OK")
  TRUE
}

# -----------------------------
# DRIVER
# -----------------------------
for (year in years) {
  
  cat(sprintf("\n[%s] ===== PROCESSING YEAR %d =====\n", ts(), year))
  
  grid <- terra::vect(grid_path)
  tiles <- seq_len(nrow(grid))
  
  cl <- makeCluster(n_cores, type = "PSOCK")
  
  clusterEvalQ(cl, {
    library(terra)
    terraOptions(tempdir = tempdir())
    NULL
  })
  
  invisible(parLapply(
    cl, tiles,
    enn_worker,
    year = year,
    patch_path_template = patch_path_template,
    grid_path = grid_path,
    searchRadius_m = searchRadius_m,
    out_dir = out_dir,
    log_dir = log_dir,
    k0 = k0,
    k_max = k_max,
    chunk_size = chunk_size,
    thin_step = thin_step
  ))
  
  stopCluster(cl)
}
