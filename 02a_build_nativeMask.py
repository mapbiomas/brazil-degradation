# ============================================================
# MAPBIOMAS COLLECTION 11 — EXPORT NOTEBOOK v3
# NATIVE VEGETATION REFERENCE + DEFORESTATION / SECONDARY VEGETATION
#
# Outputs
# -------
# Native reference:
#   1. Optional multiband categorical image to an Earth Engine Asset
#   2. One single-band categorical GeoTIFF per year to GCS (1985-2025)
#
# Deforestation / Secondary Vegetation:
#   3. Optional multiband copy to an Earth Engine Asset
#   4. One single-band categorical GeoTIFF per year to GCS (1987-2025)
#
# IMPORTANT
# ---------
# Native reference:
#   - eligible native/ignored pixels retain their ORIGINAL MapBiomas class.
#   - non-eligible pixels remain masked; GCS NoData is encoded as 0.
#
# DSV:
#   - NO remap is applied.
#   - classification_YEAR is exported with the ORIGINAL DSV legend.
#   - masked pixels are encoded as 0 only in the GeoTIFF and 0 is declared NoData.
#   - the source band's CRS + crsTransform are used for GCS export.
# ============================================================


# ============================================================
# 0. INSTALL / IMPORT
# ============================================================

# Uncomment in Google Colab if needed:
# %pip install -U earthengine-api geemap google-cloud-storage

import ee
import geemap

from google.cloud import storage

try:
    from google.colab import auth as colab_auth
except ImportError:
    colab_auth = None


# ============================================================
# 1. AUTHENTICATE / INITIALIZE EARTH ENGINE
# ============================================================

ee.Authenticate()

GCP_PROJECT = "mapbiomas-brazil"

ee.Initialize(project=GCP_PROJECT)

# Google Cloud Storage uses Google application credentials, which are
# independent from Earth Engine authentication in Colab.
if colab_auth is not None:
    colab_auth.authenticate_user()

gcs_client = storage.Client(project=GCP_PROJECT)


# ============================================================
# 2. SETTINGS
# ============================================================

version = 1

native_years = list(range(1985, 2026))
dsv_years = list(range(1987, 2026))


# ------------------------------------------------------------
# Native vegetation classes by biome
# PRESERVED FROM THE REFERENCE NOTEBOOK
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
# Classes ignored for fragmentation but retained categorically
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

DSV_ASSET = (
    "projects/mapbiomas-public/assets/brazil/lulc/"
    "collection11/"
    "mapbiomas_brazil_collection11_deforestation_secondary_vegetation_v5"
)


biomes = ee.Image(BIOMES_ASSET)
collection_all = ee.Image(COLLECTION_ASSET)
dsv_all = ee.Image(DSV_ASSET)

native_export_region = biomes.geometry()

# Use the source DSV footprint itself.
dsv_export_region = dsv_all.geometry()


# ============================================================
# 4. OUTPUT SETTINGS
# ============================================================

# ------------------------------------------------------------
# Native reference
# ------------------------------------------------------------
# Already exported in the current workflow, so disabled by default.
# Re-enable only if you explicitly want to regenerate native outputs.

EXPORT_NATIVE_TO_ASSET = False
EXPORT_NATIVE_TO_GCS = False

native_asset_name = (
    f"degradation_nativeReference_col11_v{version}"
)

native_asset_id = (
    "projects/mapbiomas-brazil/assets/"
    "DEGRADATION/COLLECTION-11/public/"
    f"{native_asset_name}"
)

# Preserve the exact native-mask GCS naming logic from the
# reference notebook so existing server-side ingest keeps working.
native_bucket_address = (
    "AUXILIARES/"
    "DEGRADACAO/"
    "COL_11/"
    "temp/"
)

native_gcs_base_name = "nativeMask"


# ------------------------------------------------------------
# Deforestation / Secondary Vegetation
# ------------------------------------------------------------

# The source already exists as a public EE Image, so copying it to another
# EE asset is not required for the server ingest. Leave FALSE unless you
# explicitly want a project-owned copy.
EXPORT_DSV_TO_ASSET = False
EXPORT_DSV_TO_GCS = True

dsv_asset_name = (
    f"degradation_deforestation_secondaryVegetation_col11_v{version}"
)

dsv_asset_id = (
    "projects/mapbiomas-brazil/assets/"
    "DEGRADATION/COLLECTION-11/public/"
    f"{dsv_asset_name}"
)

# This prefix is intentionally the same prefix used by COL11_V2's
# DSV GCS/rgrass ingestion layer.
dsv_bucket_address = (
    "AUXILIARES/"
    "DEGRADACAO/"
    "COL_11/"
    "temp/"
    "deforestation_secondary_vegetation"
)

dsv_gcs_base_name = "deforestation_secondary_vegetation"


# ------------------------------------------------------------
# Shared Google Cloud Storage / export configuration
# ------------------------------------------------------------

bucket_name = "shared-development-storage"

EXPORT_SCALE = 30
MAX_PIXELS = 1e13
EXPORT_AS_COG = True

# Optional. When None, Earth Engine decides file splitting.
# Keeping this None mirrors the native export behavior.
DSV_FILE_DIMENSIONS = None


# ------------------------------------------------------------
# RESUMABLE / DUPLICATE-PROTECTION SETTINGS
# ------------------------------------------------------------

# Before submitting an annual GCS export:
#   1. check whether one or more GeoTIFF objects already exist under
#      that exact year prefix;
#   2. check whether an Earth Engine task with the same description is
#      already READY / RUNNING / PENDING / SUBMITTED.
#
# If either condition is true, the year is skipped.
CHECK_GCS_BEFORE_EXPORT = True
CHECK_ACTIVE_EE_TASKS = True

# Optional explicit exceptions. Example:
# FORCE_REEXPORT_DSV_YEARS = [2024, 2025]
FORCE_REEXPORT_NATIVE_YEARS = []
FORCE_REEXPORT_DSV_YEARS = []

# Optional multiband EE-asset overwrite protection.
# Existing assets are skipped by default.
CHECK_EE_ASSET_BEFORE_EXPORT = True
FORCE_NATIVE_ASSET_EXPORT = False
FORCE_DSV_ASSET_EXPORT = False

ACTIVE_EE_TASK_STATES = {
    "READY",
    "RUNNING",
    "PENDING",
    "SUBMITTED",
}


# ============================================================
# 5. BUILD CATEGORICAL NATIVE REFERENCE
# ============================================================

native_recipe = None

for year_j in native_years:

    print(f"Building categorical native reference {year_j}...")

    band_name = f"classification_{year_j}"

    collection = (
        collection_all
        .select(band_name)
        .toUint8()
    )

    # Empty masked image with source projection/type.
    recipe_year = collection.updateMask(
        ee.Image.constant(0)
    )

    for biome_k in biomes_name:

        classes_to_keep = (
            native_classes[biome_k]
            + ignore_classes[biome_k]
        )

        class_mask = (
            collection
            .remap(
                classes_to_keep,
                [1] * len(classes_to_keep),
                defaultValue=0,
            )
            .eq(1)
        )

        biome_mask = biomes.eq(
            biomes_dict[biome_k]
        )

        categorical_piece = (
            collection
            .updateMask(class_mask)
            .updateMask(biome_mask)
        )

        recipe_year = recipe_year.blend(
            categorical_piece
        )

    recipe_year = (
        recipe_year
        .rename(band_name)
        .toUint8()
    )

    if native_recipe is None:
        native_recipe = recipe_year
    else:
        native_recipe = native_recipe.addBands(
            recipe_year
        )


print()
print("============================================")
print("Categorical native reference constructed.")
print(
    f"Years: {native_years[0]} - "
    f"{native_years[-1]}"
)
print(
    f"Number of bands: {len(native_years)}"
)
print("============================================")
print()


# ============================================================
# 6. PREPARE DSV MULTIBAND IMAGE
# ============================================================

dsv_band_names = [
    f"classification_{year_j}"
    for year_j in dsv_years
]

# No remap. No reclassification. Preserve source values and masks.
dsv_recipe = (
    dsv_all
    .select(dsv_band_names)
    .toUint8()
)

print()
print("============================================")
print("DSV source prepared with ORIGINAL legend.")
print(
    f"Years: {dsv_years[0]} - "
    f"{dsv_years[-1]}"
)
print(
    f"Number of bands: {len(dsv_years)}"
)
print("============================================")
print()


# ============================================================
# 7. OPTIONAL MAP VISUALIZATION
# ============================================================

Map = geemap.Map()

Map.center_object(
    biomes,
    4
)

native_vis = {
    "min": 1,
    "max": 84,
}

Map.add_layer(
    native_recipe.select(
        "classification_1985"
    ),
    native_vis,
    "Native categorical reference 1985",
)

Map.add_layer(
    native_recipe.select(
        "classification_2025"
    ),
    native_vis,
    "Native categorical reference 2025",
)

# Raw DSV bands can be inspected without applying a guessed legend/palette.
Map.add_layer(
    dsv_recipe.select(
        "classification_1987"
    ),
    {},
    "DSV original classification 1987",
)

Map.add_layer(
    dsv_recipe.select(
        "classification_2025"
    ),
    {},
    "DSV original classification 2025",
)

display(Map)


# ============================================================
# 8. EXPORT HELPERS
# ============================================================

export_tasks = []
skipped_exports = []
forced_exports = []


def categorical_format_options():

    if EXPORT_AS_COG:
        return {
            "cloudOptimized": True,
            "noData": 0,
        }

    return {
        "noData": 0,
    }


def source_projection_kwargs(image):

    projection_info = (
        image
        .projection()
        .getInfo()
    )

    return {
        "crs": projection_info["crs"],
        "crsTransform": projection_info["transform"],
    }


def ee_asset_exists(asset_id):
    """Return True only when the exact EE asset exists."""

    try:
        ee.data.getAsset(asset_id)
        return True
    except Exception:
        return False


def current_active_ee_tasks():
    """
    Return {description: state} for currently active Earth Engine tasks.

    This prevents a rerun of the notebook from submitting duplicate tasks
    while an earlier task is still READY/RUNNING but has not yet created a
    GCS object.
    """

    if not CHECK_ACTIVE_EE_TASKS:
        return {}

    result = {}

    for task_info in ee.data.getTaskList():

        state = task_info.get("state")
        description = task_info.get("description")

        if (
            description
            and state in ACTIVE_EE_TASK_STATES
        ):
            result[description] = state

    return result


active_ee_tasks = current_active_ee_tasks()


def first_existing_geotiff(prefix):
    """
    Return the first existing .tif/.tiff object under an exact GCS prefix.

    Earth Engine may write either a single object:
        PREFIX.tif

    or sharded objects:
        PREFIX-0000000000-0000000000.tif
        PREFIX-...

    so annual existence must be checked by prefix, not by one exact filename.
    """

    if not CHECK_GCS_BEFORE_EXPORT:
        return None

    blobs = gcs_client.list_blobs(
        bucket_name,
        prefix=prefix,
    )

    for blob in blobs:

        name_lower = blob.name.lower()

        if (
            name_lower.endswith(".tif")
            or name_lower.endswith(".tiff")
        ):
            return blob.name

    return None


def should_submit_annual_export(
    dataset,
    year,
    description,
    file_prefix,
    force_years,
):
    """
    Decide whether an annual GCS export should be submitted.

    Priority:
      FORCE year
      existing GCS GeoTIFF prefix
      active EE task with same description
      otherwise submit
    """

    if year in force_years:

        forced_exports.append({
            "dataset": dataset,
            "year": year,
            "description": description,
            "reason": "FORCED",
        })

        return True

    existing_object = first_existing_geotiff(
        file_prefix
    )

    if existing_object is not None:

        skipped_exports.append({
            "dataset": dataset,
            "year": year,
            "description": description,
            "reason": "GCS_EXISTS",
            "detail": existing_object,
        })

        print(
            f"{dataset} {year} -> SKIP | "
            f"GCS already exists: "
            f"gs://{bucket_name}/{existing_object}"
        )

        return False

    active_state = active_ee_tasks.get(
        description
    )

    if active_state is not None:

        skipped_exports.append({
            "dataset": dataset,
            "year": year,
            "description": description,
            "reason": "ACTIVE_EE_TASK",
            "detail": active_state,
        })

        print(
            f"{dataset} {year} -> SKIP | "
            f"EE task already {active_state}"
        )

        return False

    return True


def register_started_task(description, task):
    """
    Register the newly-created task locally so the current notebook run
    cannot accidentally create a second task with the same description.
    """

    state = task.status().get(
        "state",
        "READY",
    )

    active_ee_tasks[description] = state


# ============================================================
# 9A. NATIVE — OPTIONAL MULTIBAND EE ASSET
# ============================================================

if EXPORT_NATIVE_TO_ASSET:

    print()
    print("Checking native categorical EE Asset...")

    native_asset_already_exists = (
        CHECK_EE_ASSET_BEFORE_EXPORT
        and ee_asset_exists(native_asset_id)
    )

    if (
        native_asset_already_exists
        and not FORCE_NATIVE_ASSET_EXPORT
    ):

        print(
            "NATIVE ASSET -> SKIP | "
            f"already exists: {native_asset_id}"
        )

    else:

        print(
            "Starting native categorical "
            "EE Asset export..."
        )

        native_asset_task = (
            ee.batch.Export.image.toAsset(
                image=native_recipe,
                description=native_asset_name,
                assetId=native_asset_id,
                region=native_export_region,
                scale=EXPORT_SCALE,
                maxPixels=MAX_PIXELS,
                pyramidingPolicy={
                    ".default": "mode"
                },
            )
        )

        native_asset_task.start()

        export_tasks.append({
            "dataset": "NATIVE",
            "type": "ASSET",
            "name": native_asset_name,
            "task": native_asset_task,
        })

        register_started_task(
            native_asset_name,
            native_asset_task,
        )

        print(
            f"NATIVE ASSET -> {native_asset_id}"
        )


# ============================================================
# 9B. NATIVE — ONE ANNUAL GEOTIFF PER YEAR TO GCS
# ============================================================

if EXPORT_NATIVE_TO_GCS:

    print()
    print("Starting native categorical GCS exports...")
    print()

    for year_j in native_years:

        band_name = (
            f"classification_{year_j}"
        )

        output_name = (
            f"{native_gcs_base_name}-"
            f"{band_name}"
        )

        # Explicit slash-safe object prefix:
        # .../COL_11/temp/nativeMask-classification_YEAR
        file_prefix = (
            f"{native_bucket_address.rstrip('/')}/"
            f"{output_name}"
        )

        export_image = (
            native_recipe
            .select(band_name)
            .unmask(0)
        )

        if not should_submit_annual_export(
            dataset="NATIVE",
            year=year_j,
            description=output_name,
            file_prefix=file_prefix,
            force_years=FORCE_REEXPORT_NATIVE_YEARS,
        ):
            continue

        native_gcs_task = (
            ee.batch.Export.image.toCloudStorage(
                image=export_image,
                description=output_name,
                bucket=bucket_name,
                fileNamePrefix=file_prefix,
                region=native_export_region,
                scale=EXPORT_SCALE,
                maxPixels=MAX_PIXELS,
                fileFormat="GeoTIFF",
                formatOptions=categorical_format_options(),
            )
        )

        native_gcs_task.start()

        export_tasks.append({
            "dataset": "NATIVE",
            "type": "GCS",
            "year": year_j,
            "name": output_name,
            "task": native_gcs_task,
        })

        register_started_task(
            output_name,
            native_gcs_task,
        )

        print(
            f"NATIVE {year_j} -> SUBMITTED | "
            f"gs://{bucket_name}/"
            f"{file_prefix}*.tif"
        )


# ============================================================
# 10A. DSV — OPTIONAL MULTIBAND EE ASSET COPY
# ============================================================

if EXPORT_DSV_TO_ASSET:

    print()
    print("Checking DSV multiband EE Asset...")

    dsv_asset_already_exists = (
        CHECK_EE_ASSET_BEFORE_EXPORT
        and ee_asset_exists(dsv_asset_id)
    )

    if (
        dsv_asset_already_exists
        and not FORCE_DSV_ASSET_EXPORT
    ):

        print(
            "DSV ASSET -> SKIP | "
            f"already exists: {dsv_asset_id}"
        )

    else:

        print(
            "Starting DSV multiband "
            "EE Asset export..."
        )

        first_dsv_band = (
            dsv_recipe
            .select(
                f"classification_{dsv_years[0]}"
            )
        )

        dsv_projection = (
            source_projection_kwargs(
                first_dsv_band
            )
        )

        dsv_asset_task = (
            ee.batch.Export.image.toAsset(
                image=dsv_recipe,
                description=dsv_asset_name,
                assetId=dsv_asset_id,
                region=dsv_export_region,
                crs=dsv_projection["crs"],
                crsTransform=dsv_projection[
                    "crsTransform"
                ],
                maxPixels=MAX_PIXELS,
                pyramidingPolicy={
                    ".default": "mode"
                },
            )
        )

        dsv_asset_task.start()

        export_tasks.append({
            "dataset": "DSV",
            "type": "ASSET",
            "name": dsv_asset_name,
            "task": dsv_asset_task,
        })

        register_started_task(
            dsv_asset_name,
            dsv_asset_task,
        )

        print(
            f"DSV ASSET -> {dsv_asset_id}"
        )


# ============================================================
# 10B. DSV — ONE ORIGINAL-LEGEND GEOTIFF PER YEAR TO GCS
# ============================================================

if EXPORT_DSV_TO_GCS:

    print()
    print(
        "Starting DSV original-legend "
        "GCS exports..."
    )
    print()

    for year_j in dsv_years:

        band_name = (
            f"classification_{year_j}"
        )

        source_band = (
            dsv_all
            .select(band_name)
            .toUint8()
        )

        # Preserve raw DSV category values.
        export_image = source_band.unmask(0)

        output_name = (
            f"{dsv_gcs_base_name}-"
            f"{band_name}"
        )

        # Explicit slash-safe object prefix:
        # .../COL_11/temp/deforestation_secondary_vegetation/
        # deforestation_secondary_vegetation-classification_YEAR
        file_prefix = (
            f"{dsv_bucket_address.rstrip('/')}/"
            f"{output_name}"
        )

        projection_kwargs = (
            source_projection_kwargs(
                source_band
            )
        )

        dsv_export_args = dict(
            image=export_image,
            description=output_name,
            bucket=bucket_name,
            fileNamePrefix=file_prefix,
            region=dsv_export_region,
            crs=projection_kwargs["crs"],
            crsTransform=projection_kwargs[
                "crsTransform"
            ],
            maxPixels=MAX_PIXELS,
            fileFormat="GeoTIFF",
            formatOptions=categorical_format_options(),
        )

        # Optional explicit file splitting.
        if DSV_FILE_DIMENSIONS is not None:
            dsv_export_args.update({
                "shardSize": 256,
                "fileDimensions": (
                    DSV_FILE_DIMENSIONS
                ),
            })

        if not should_submit_annual_export(
            dataset="DSV",
            year=year_j,
            description=output_name,
            file_prefix=file_prefix,
            force_years=FORCE_REEXPORT_DSV_YEARS,
        ):
            continue

        dsv_gcs_task = (
            ee.batch.Export.image.toCloudStorage(
                **dsv_export_args
            )
        )

        dsv_gcs_task.start()

        export_tasks.append({
            "dataset": "DSV",
            "type": "GCS",
            "year": year_j,
            "name": output_name,
            "task": dsv_gcs_task,
        })

        register_started_task(
            output_name,
            dsv_gcs_task,
        )

        print(
            f"DSV {year_j} -> SUBMITTED | "
            f"gs://{bucket_name}/"
            f"{file_prefix}*.tif"
        )


# ============================================================
# 11. EXPORT SUMMARY
# ============================================================

native_task_count = sum(
    item["dataset"] == "NATIVE"
    for item in export_tasks
)

dsv_task_count = sum(
    item["dataset"] == "DSV"
    for item in export_tasks
)

print()
print("============================================")
print("ALL EXPORT TASKS SUBMITTED")
print("============================================")
print(
    f"Native tasks: {native_task_count}"
)
print(
    f"DSV tasks:    {dsv_task_count}"
)
print(
    f"Total tasks:  {len(export_tasks)}"
)

print(
    f"Skipped annual exports: "
    f"{len(skipped_exports)}"
)

print(
    f"Forced annual exports:  "
    f"{len(forced_exports)}"
)

if skipped_exports:

    skipped_gcs = sum(
        item["reason"] == "GCS_EXISTS"
        for item in skipped_exports
    )

    skipped_tasks = sum(
        item["reason"] == "ACTIVE_EE_TASK"
        for item in skipped_exports
    )

    print(
        f"  - GCS already exists: "
        f"{skipped_gcs}"
    )

    print(
        f"  - active EE task:      "
        f"{skipped_tasks}"
    )

print("============================================")


# ============================================================
# 12. SKIPPED-YEAR SUMMARY
# ============================================================

if skipped_exports:

    print()
    print("Skipped annual exports:")
    print()

    for item in skipped_exports:

        print(
            item["dataset"],
            "|",
            item["year"],
            "|",
            item["reason"],
            "|",
            item.get("detail", ""),
        )


# ============================================================
# 13. INITIAL TASK STATUS
# ============================================================

print()
print("Initial task status:")
print()

for item in export_tasks:

    task = item["task"]
    status = task.status()

    print(
        item["dataset"],
        "|",
        item["type"],
        "|",
        item["name"],
        "|",
        status.get("state"),
    )


# ============================================================
# 14. USEFUL GCS PREFIXES
# ============================================================

print()
print("============================================")
print("GCS PREFIXES")
print("============================================")

print(
    "Native:",
    f"gs://{bucket_name}/"
    f"{native_bucket_address.rstrip('/')}/"
    f"{native_gcs_base_name}-"
    "classification_YEAR*"
)

print(
    "DSV:",
    f"gs://{bucket_name}/"
    f"{dsv_bucket_address.rstrip('/')}/"
    f"{dsv_gcs_base_name}-"
    "classification_YEAR*"
)

print("============================================")
