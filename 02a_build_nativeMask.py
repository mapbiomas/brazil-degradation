# ============================================================
# NATIVE VEGETATION MASK - MAPBIOMAS COLLECTION 11
#
# Outputs:
#   1. One multiband image to an Earth Engine Asset
#   2. One single-band GeoTIFF per year to Google Cloud Storage
#
# Original contacts:
# dhemerson.costa@ipam.org.br
# mrosa@arcplan.com.br
# ============================================================


# ============================================================
# 0. INSTALL / IMPORT
# ============================================================

# Uncomment if needed in Google Colab:
# %pip install -U earthengine-api geemap

import ee
import geemap


# ============================================================
# 1. AUTHENTICATE / INITIALIZE EARTH ENGINE
# ============================================================

ee.Authenticate()

# Change this to the Google Cloud project used to run EE.
GCP_PROJECT = "mapbiomas-brazil"

ee.Initialize(project=GCP_PROJECT)


# ============================================================
# 2. SETTINGS
# ============================================================

version = 1

years_list = list(range(1985, 2026))


# ------------------------------------------------------------
# Native vegetation classes by biome
# ------------------------------------------------------------

native_classes = {
    "amazonia":       [3, 4, 5, 6, 11, 12, 49, 50],
    "caatinga":       [3, 4, 5, 11, 12, 49, 50, 77],
    "cerrado":        [3, 4, 5, 11, 12, 49, 50],
    "mata_atlantica": [3, 4, 5, 11, 12, 49, 50],
    "pampa":          [3, 4, 5, 11, 12, 49, 50, 84],
    "pantanal":       [3, 4, 5, 7, 11, 12, 49, 50],
}


# ------------------------------------------------------------
# Classes ignored for fragmentation
#
# 13 = Other non-forest
# 29 = Rocky outcrop
# 32 = Hypersaline tidal flat
# 33 = Water
# ------------------------------------------------------------

ignore_classes = {
    "amazonia":       [13, 29, 32],
    "caatinga":       [13, 29, 32],
    "cerrado":        [13, 29, 32],
    "mata_atlantica": [13, 29, 32],
    "pampa":          [13, 29, 32],
    "pantanal":       [13, 29, 32, 33],
}


# ------------------------------------------------------------
# Biome IDs
# ------------------------------------------------------------

biomes_dict = {
    "amazonia":       1,
    "caatinga":       2,
    "cerrado":        3,
    "mata_atlantica": 4,
    "pampa":          5,
    "pantanal":       6,
}

biomes_name = list(biomes_dict.keys())


# ============================================================
# 3. INPUT ASSETS
# ============================================================

BIOMES_ASSET = (
    "projects/mapbiomas-workspace/"
    "AUXILIAR/biome_2025_buf5k_30m"
)

COLLECTION_ASSET = (
    "projects/mapbiomas-public/assets/brazil/lulc/"
    "collection11/mapbiomas_brazil_collection11_coverage_v3"
)

biomes = ee.Image(BIOMES_ASSET)

collection_all = ee.Image(COLLECTION_ASSET)

export_region = biomes.geometry()


# ============================================================
# 4. OUTPUT SETTINGS
# ============================================================

# ------------------------------------------------------------
# Export to Earth Engine Asset?
# ------------------------------------------------------------

EXPORT_TO_ASSET = True

asset_name = f"degradation_nativeReference_col11_v{version}"

asset_id = (
    "projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-11/public/"
    f"{asset_name}"
)


# ------------------------------------------------------------
# Export to Google Cloud Storage?
# ------------------------------------------------------------

EXPORT_TO_GCS = True

bucket_name = "shared-development-storage"

bucket_address = (
    "AUXILIARES/"
    "DEGRADACAO/"
    "COL_11/"
    "temp/"
)

gcs_base_name = "nativeMask"


# ------------------------------------------------------------
# General export configuration
# ------------------------------------------------------------

EXPORT_SCALE = 30

MAX_PIXELS = 1e13

EXPORT_AS_COG = True


# ============================================================
# 5. BUILD NATIVE VEGETATION MASK
# ============================================================

recipe = None


for year_j in years_list:

    print(f"Building {year_j}...")

    # Select yearly MapBiomas band
    collection = collection_all.select(
        f"classification_{year_j}"
    )

    # Empty yearly image
    recipe_year = ee.Image(0)

    # --------------------------------------------------------
    # Process biome-specific rules
    # --------------------------------------------------------

    for biome_k in biomes_name:

        classes_to_keep = (
            native_classes[biome_k]
            + ignore_classes[biome_k]
        )

        # Native + ignored classes -> 1
        # Everything else -> 0
        native_mask = (
            collection

            .remap(
                classes_to_keep,
                [1] * len(classes_to_keep),
                defaultValue=0,
            )

            # Restrict to biome
            .updateMask(
                biomes.eq(
                    biomes_dict[biome_k]
                )
            )

            # Keep only 1-valued pixels
            .selfMask()
        )

        # ----------------------------------------------------
        # Optional infrastructure layer
        # ----------------------------------------------------
        #
        # Equivalent to original JS:
        #
        # native_mask = native_mask.blend(
        #     dnit_roads.remap([1], [21])
        # )
        #
        # Uncomment if dnit_roads is defined.


        # Merge biome mask into yearly image
        recipe_year = (
            recipe_year
            .blend(native_mask)
            .selfMask()
        )


    # --------------------------------------------------------
    # Rename yearly band
    # --------------------------------------------------------

    recipe_year = recipe_year.rename(
        f"classification_{year_j}"
    )


    # --------------------------------------------------------
    # Add to final multiband image
    # --------------------------------------------------------

    if recipe is None:

        recipe = recipe_year

    else:

        recipe = recipe.addBands(
            recipe_year
        )


print()
print("============================================")
print("Native vegetation mask constructed.")
print(f"Years: {years_list[0]} - {years_list[-1]}")
print(f"Number of bands: {len(years_list)}")
print("============================================")
print()


# ============================================================
# 6. OPTIONAL MAP VISUALIZATION
# ============================================================

Map = geemap.Map()

Map.center_object(
    biomes,
    4
)

native_vis = {
    "min": 1,
    "max": 1,
    "palette": ["006400"],
}


Map.add_layer(
    recipe.select(
        "classification_1985"
    ),
    native_vis,
    "Native mask 1985",
)


Map.add_layer(
    recipe.select(
        "classification_2025"
    ),
    native_vis,
    "Native mask 2025",
)


display(Map)


# ============================================================
# 7. EXPORT TASKS
# ============================================================

export_tasks = []


# ============================================================
# 7A. EXPORT MULTIBAND IMAGE TO EARTH ENGINE ASSET
# ============================================================

if EXPORT_TO_ASSET:

    print()
    print("Starting Earth Engine Asset export...")

    asset_task = ee.batch.Export.image.toAsset(

        image=recipe,

        description=asset_name,

        assetId=asset_id,

        region=export_region,

        scale=EXPORT_SCALE,
        
        maxPixels=MAX_PIXELS,

        # Categorical / binary data
        pyramidingPolicy={
            ".default": "mode"
        },
    )


    asset_task.start()


    export_tasks.append({
        "type": "ASSET",
        "name": asset_name,
        "task": asset_task,
    })


    print(
        f"ASSET -> {asset_id}"
    )


# ============================================================
# 7B. EXPORT EACH YEAR DIRECTLY TO GCS
# ============================================================

if EXPORT_TO_GCS:

    print()
    print("Starting Google Cloud Storage exports...")
    print()


    for year_j in years_list:

        band_name = (
            f"classification_{year_j}"
        )


        output_name = (
            f"{gcs_base_name}-"
            f"{band_name}"
        )


        file_prefix = (
            f"{bucket_address}"
            f"{output_name}"
        )


        # ----------------------------------------------------
        # GeoTIFF configuration
        # ----------------------------------------------------

        if EXPORT_AS_COG:

            format_options = {
                "cloudOptimized": True
            }

        else:

            format_options = {}


        # ----------------------------------------------------
        # Export task
        # ----------------------------------------------------

        gcs_task = (
            ee.batch.Export.image.toCloudStorage(

                # Directly export the band from recipe.
                # No intermediate EE Asset is required.
                image=recipe.select(
                    band_name
                ),

                description=output_name,

                bucket=bucket_name,

                fileNamePrefix=file_prefix,

                region=export_region,

                scale=EXPORT_SCALE,

                maxPixels=MAX_PIXELS,

                fileFormat="GeoTIFF",

                formatOptions=format_options
            )
        )


        gcs_task.start()


        export_tasks.append({
            "type": "GCS",
            "year": year_j,
            "name": output_name,
            "task": gcs_task,
        })


        print(
            f"{year_j} -> "
            f"gs://{bucket_name}/"
            f"{file_prefix}.tif"
        )


# ============================================================
# 8. EXPORT SUMMARY
# ============================================================

print()
print("============================================")
print("ALL EXPORT TASKS SUBMITTED")
print("============================================")

print(
    f"Asset export: "
    f"{'YES' if EXPORT_TO_ASSET else 'NO'}"
)

print(
    f"GCS exports: "
    f"{len(years_list) if EXPORT_TO_GCS else 0}"
)

print(
    f"Total tasks: "
    f"{len(export_tasks)}"
)

print("============================================")


# ============================================================
# 9. PRINT INITIAL TASK STATUS
# ============================================================

print()
print("Initial task status:")
print()


for item in export_tasks:

    task = item["task"]

    status = task.status()

    print(
        item["type"],
        "|",
        item["name"],
        "|",
        status.get("state")
    )
