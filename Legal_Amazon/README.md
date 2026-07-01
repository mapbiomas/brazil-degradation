# MapBiomas Degradation

This repository gathers the scripts used to map forest degradation in the Amazon (MapBiomas initiative). The scripts run in **Google Earth Engine** (JavaScript) and **QGIS** (Python), and are organized into two sequential processing pipelines: **Canopy Disturbance** and **Logging**.

Each file follows the naming pattern `NN_category_step-description`, where `NN` indicates the execution order within its processing pipeline.

---

## Canopy Disturbance

Detects and classifies drops in the NDFI index associated with forest canopy disturbance, year by year.

- `01_disturbance_step-processing-dam.js` — Computes NDFI from Landsat collections, compares each month against a historical reference (global or seasonal median of the previous 36 months), and sums the months with a drop within the defined threshold range, exporting the annual disturbance frequency (`freq_dam`) as an asset.
- `02_disturbance_step-post-processing-grids-bounds.js` — Intersects disturbance polygons from reference sources (SIMEX, DETER/INPE, among others) with the Legal Amazon grid mesh, selects the affected grids, and exports them as a table (asset and Shapefile).
- `03_disturbance_step-post-processing-classification.js` — Classifies disturbance pixels into categories (fire, noise/logging, hilltop relief, wetlands, anthropization edge), separates fragments by size, and applies contextual masks, exporting the final classification per year.
- `04_disturbance_step-post-processing-masking-classification-frequency.js` — Combines frequency, classification, and the logging layer to apply "survival" rules to the signal over time, generating the final canopy disturbance mask per year (includes an optional block for batch export from 1988–2024).

## Logging

Detects, filters, and vectorizes selective logging areas from the canopy disturbance layer.

- `01_logging_step-processing-spatial-logging-grids.js` — Applies spatial filters (disturbance frequency, neighborhood, patch size, local/regional density, and variance) to the disturbance layer to isolate pixels consistent with selective logging, aggregates the results into a 7.68 km grid, and displays an interactive map with a legend.
- `02_logging_step-post-processing-masking.js` — Applies exclusion masks (relief above 300 m, pedology, anthropization edge) to the disturbance layer to refine logging detection before export.
- `03_logging_step-processing_vector_logging.js` — Vectorizes the logging raster collection, year by year, and exports the resulting shapefiles to Google Drive.
- `04_logging_step-processing-logging-area-estimated-polygon.py` — Python script for QGIS that refines the geometry of the vectorized polygons (merges nearby patches with a positive/negative buffer, splits multipart features, and applies an oriented bounding box, convex hull, or Douglas-Peucker simplification), computes ID and area in hectares, and exports the final shapefile.

