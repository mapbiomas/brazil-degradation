# ============================================================
# CATEGORICAL NATIVE VEGETATION REFERENCE
# MAPBIOMAS COLLECTION 11
#
# Outputs:
#   1. One multiband categorical image to an Earth Engine Asset
#   2. One single-band categorical GeoTIFF per year to GCS
#
# IMPORTANT:
#   Pixels considered native/ignored for fragmentation retain
#   their ORIGINAL MapBiomas class value.
#
#   All other pixels remain masked / NoData.
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

GCP_PROJECT = "mapbiomas-brazil"

ee.Initialize(project=GCP_PROJECT)


# ============================================================
# 2. SETTINGS
# ============================================================

version = 1

years_list = list(range(1985, 2026))


# ------------------------------------------------------------
# Native vegetation classes by biome
#
# PRESERVED EXACTLY FROM YOUR INPUT SCRIPT
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
# These are STILL RETAINED in the categorical raster.
#
# This is important because in the current methodology these
# classes participate in connectivity.
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
#
# PRESERVED EXACTLY FROM YOUR INPUT SCRIPT
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

EXPORT_TO_ASSET = True
EXPORT_TO_GCS = True


# ------------------------------------------------------------
# Earth Engine Asset
# ------------------------------------------------------------

asset_name = (
    f"degradation_nativeReference_col11_v{version}"
)

asset_id = (
    "projects/mapbiomas-brazil/assets/"
    "DEGRADATION/COLLECTION-11/public/"
    f"{asset_name}"
)


# ------------------------------------------------------------
# Google Cloud Storage
# ------------------------------------------------------------

bucket_name = "shared-development-storage"

bucket_address = (
    "AUXILIARES/"
    "DEGRADACAO/"
    "COL_11/"
    "nativeMask"
)

gcs_base_name = "nativeMask"


# ------------------------------------------------------------
# Export configuration
# ------------------------------------------------------------

EXPORT_SCALE = 30

MAX_PIXELS = 1e13

EXPORT_AS_COG = True


# ============================================================
# 5. BUILD CATEGORICAL NATIVE REFERENCE
# ============================================================

recipe = None


for year_j in years_list:

    print(f"Building categorical reference {year_j}...")

    band_name = f"classification_{year_j}"

    # --------------------------------------------------------
    # Original MapBiomas classification
    # --------------------------------------------------------

    collection = (
        collection_all
        .select(band_name)
        .toUint8()
    )


    # --------------------------------------------------------
    # Empty image with SAME projection/type/geometry as source
    #
    # This is preferable to ee.Image(0), because we retain the
    # source raster's projection characteristics.
    # --------------------------------------------------------

    recipe_year = collection.updateMask(
        ee.Image.constant(0)
    )


    # --------------------------------------------------------
    # Apply biome-specific rules
    # --------------------------------------------------------

    for biome_k in biomes_name:

        classes_to_keep = (
            native_classes[biome_k]
            + ignore_classes[biome_k]
        )


        # ----------------------------------------------------
        # Build boolean mask:
        #
        # eligible classes = 1
        # everything else  = 0
        #
        # BUT DO NOT remap the final raster.
        # ----------------------------------------------------

        class_mask = (
            collection
            .remap(
                classes_to_keep,
                [1] * len(classes_to_keep),
                defaultValue=0,
            )
            .eq(1)
        )


        # ----------------------------------------------------
        # Restrict to biome
        # ----------------------------------------------------

        biome_mask = biomes.eq(
            biomes_dict[biome_k]
        )


        # ----------------------------------------------------
        # KEY CHANGE
        #
        # Preserve original categorical class values.
        #
        # Example:
        #
        # class 3  stays 3
        # class 4  stays 4
        # class 12 stays 12
        # class 29 stays 29
        #
        # Non-eligible pixels become masked.
        # ----------------------------------------------------

        categorical_piece = (
            collection
            .updateMask(class_mask)
            .updateMask(biome_mask)
        )


        # ----------------------------------------------------
        # Add biome to Brazil-wide annual raster
        # ----------------------------------------------------

        recipe_year = recipe_year.blend(
            categorical_piece
        )


    # --------------------------------------------------------
    # Rename / datatype
    # --------------------------------------------------------

    recipe_year = (
        recipe_year
        .rename(band_name)
        .toUint8()
    )


    # --------------------------------------------------------
    # Add year to multiband image
    # --------------------------------------------------------

    if recipe is None:

        recipe = recipe_year

    else:

        recipe = recipe.addBands(
            recipe_year
        )


print()
print("============================================")
print("Categorical native reference constructed.")
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


# ------------------------------------------------------------
# Simple visualization.
#
# This is only for inspection.
# Values are the ACTUAL MapBiomas classes.
# ------------------------------------------------------------

categorical_vis = {
    "min": 1,
    "max": 84,
}


Map.add_layer(
    recipe.select(
        "classification_1985"
    ),
    categorical_vis,
    "Categorical native reference 1985",
)


Map.add_layer(
    recipe.select(
        "classification_2025"
    ),
    categorical_vis,
    "Categorical native reference 2025",
)


display(Map)


# ============================================================
# 7. EXPORT TASKS
# ============================================================

export_tasks = []


# ============================================================
# 7A. EXPORT MULTIBAND CATEGORICAL IMAGE TO EE ASSET
# ============================================================

if EXPORT_TO_ASSET:

    print()
    print("Starting categorical EE Asset export...")

    asset_task = ee.batch.Export.image.toAsset(

        image=recipe,

        description=asset_name,

        assetId=asset_id,

        region=export_region,

        scale=EXPORT_SCALE,

        maxPixels=MAX_PIXELS,

        # Correct for categorical data
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
    print("Starting categorical GCS exports...")
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
        # Select categorical band
        # ----------------------------------------------------

        export_image = recipe.select(
            band_name
        )


        # ----------------------------------------------------
        # Explicit GeoTIFF NoData representation
        #
        # All masked pixels become 0 in the stored raster,
        # while 0 is declared as NoData.
        #
        # All valid MapBiomas categories are > 0.
        # ----------------------------------------------------

        export_image = export_image.unmask(0)


        # ----------------------------------------------------
        # GeoTIFF configuration
        # ----------------------------------------------------

        if EXPORT_AS_COG:

            format_options = {
                "cloudOptimized": True,
                "noData": 0,
            }

        else:

            format_options = {
                "noData": 0,
            }


        # ----------------------------------------------------
        # Export
        # ----------------------------------------------------

        gcs_task = (
            ee.batch.Export.image.toCloudStorage(

                image=export_image,

                description=output_name,

                bucket=bucket_name,

                fileNamePrefix=file_prefix,

                region=export_region,

                scale=EXPORT_SCALE,

                maxPixels=MAX_PIXELS,

                fileFormat="GeoTIFF",

                formatOptions=format_options,
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
# 9. INITIAL TASK STATUS
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
