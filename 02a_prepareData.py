# ============================================================
# MAPBIOMAS / COL11_V2 — GCS SOURCE EXPORTER v4.4
#
# Purpose
# -------
# Export the canonical source rasters required by COL11_V2 Degradation to GCS,
# using one annual single-band GeoTIFF per year/theme (plus one
# accumulated MapBiomas Alerta Brasil layer).
#
# Design principles
# -----------------
# - Theme switches are centralized at the top.
# - Existing GCS outputs and active EE tasks are skipped by default.
# - Source CRS + source crsTransform are preserved.
# - No interpolation/resampling is performed by this notebook.
# - Categorical source legends are preserved unless an explicit,
#   documented analysis transform is required.
# - Annual GCS prefixes follow one simple naming convention:
#     lulc_YEAR
#     secondary_vegetation_YEAR
#     secondary_vegetation_age_YEAR
#     fire_monthly_YEAR
#     canopy_disturbance_YEAR
# - Derived temporal metrics (fire frequency, years since fire, etc.)
#   are NOT exported; they should be computed locally in COL11_V2.
#
# Themes
# ------
# LULC:
#   Original Collection 11 annual classification, 1985-2025.
#
# Secondary vegetation:
#   Original DSV deforestation/secondary-vegetation classes, 1987-2025.
#
# Secondary vegetation age:
#   Source is packed Int16. Exported product is DECODED age:
#       age = floor(raw / 100)
#   Age 0/background is written as NoData=0.
#
# Fire monthly:
#   0 = not burned in the year
#   1..12 = month assigned to burned pixel
#   0 is a VALID value; GeoTIFF NoData is reserved as 255.
#   Annual burned/no-burn, burned-year frequency, last-fire year,
#   years-since-fire, and rolling fire metrics are derived locally.
#
# Canopy disturbance:
#   Preserve the ORIGINAL source frequency values 1..12.
#   No threshold/binarization is applied during export.
#   Masked/background pixels are written as NoData=0.
#   If a binary disturbance mask is needed locally, use >1 there.
#   Source product is Collection 10.1 and covers 1988-2024.
#
# MapBiomas Alerta Brasil:
#   Single accumulated binary assessment layer for 2019-2025.
#   Coverage is Brazil (not Cerrado-only).
#   1 = deforested sometime in the period; 0 = no mapped alert.
#   0 is a VALID value; GeoTIFF NoData is reserved as 255.
#   This is a period-level corroboration layer, not an annual loss product.
#
# Native mask legacy:
#   Retained only for backwards compatibility with the old pipeline.
#   Disabled by default. New COL11_V2 work should use full LULC + secondary vegetation
#   to construct the analysis mask locally.
# ============================================================


# ============================================================
# 0. EDIT THIS BLOCK ONLY FOR NORMAL RUNS
# ============================================================

# Turn themes on/off here.
EXPORT_THEMES = {
    "lulc": True,
    "secondary_vegetation": True,
    "secondary_vegetation_age": True,
    "fire": True,
    "canopy_disturbance": True,
    "mapbiomas_alerta": True,

    # Legacy product. Normally keep False.
    "native_mask_legacy": False,
}

# Inspect what would be submitted without starting EE export tasks.
DRY_RUN = False

# Duplicate protection.
CHECK_GCS_BEFORE_EXPORT = True
CHECK_ACTIVE_EE_TASKS = True
VALIDATE_SOURCE_BANDS = True

# Force specific annual years even when GCS output already exists.
# Leave empty for normal resumable operation.
FORCE_REEXPORT_YEARS = {
    "lulc": [],
    "secondary_vegetation": [],
    "secondary_vegetation_age": [],
    "fire": [],
    "canopy_disturbance": [],
    "native_mask_legacy": [],
}

# Single accumulated asset.
FORCE_REEXPORT_ALERTA = False

# Optional cap on NEW tasks started in one notebook run.
# None = no cap.
MAX_NEW_TASKS = None

# GCP / GCS.
GCP_PROJECT = "mapbiomas-brazil"
BUCKET_NAME = "shared-development-storage"

# All themes use the same standardized directory convention:
#     <GCS_TEMP_ROOT>/<theme>/
GCS_TEMP_ROOT = "AUXILIARES/DEGRADACAO/COL_11/temp"

# Export behavior.
MAX_PIXELS = 1e13
EXPORT_AS_COG = True

# Optional Earth Engine file splitting. None lets EE decide.
FILE_DIMENSIONS = None


# ============================================================
# 1. INSTALL / IMPORT
# ============================================================

# Uncomment in Google Colab if needed:
# %pip install -U earthengine-api google-cloud-storage

import ee
from google.cloud import storage

try:
    from google.colab import auth as colab_auth
except ImportError:
    colab_auth = None


# ============================================================
# 2. AUTHENTICATE / INITIALIZE
# ============================================================

ee.Authenticate()
ee.Initialize(project=GCP_PROJECT)

# Earth Engine authentication and Google Cloud application credentials
# are separate in Colab.
if colab_auth is not None:
    colab_auth.authenticate_user()

gcs_client = storage.Client(project=GCP_PROJECT)


# ============================================================
# 3. SOURCE ASSETS / YEARS
# ============================================================

BIOMES_ASSET = (
    "projects/mapbiomas-workspace/"
    "AUXILIAR/biome_2025_buf5k_30m"
)

LULC_ASSET = (
    "projects/mapbiomas-public/assets/brazil/lulc/"
    "collection11/mapbiomas_brazil_collection11_coverage_v3"
)

DSV_ASSET = (
    "projects/mapbiomas-public/assets/brazil/lulc/"
    "collection11/"
    "mapbiomas_brazil_collection11_deforestation_secondary_vegetation_v5"
)

SECONDARY_AGE_ASSET = (
    "projects/mapbiomas-brazil/assets/"
    "DEGRADATION/COLLECTION-11/public/"
    "degradation_secondaryVegetation_col11_v1"
)

FIRE_MONTHLY_ASSET = (
    "projects/mapbiomas-public/assets/brazil/fire/"
    "collection5_1/mapbiomas_fire_collection51_monthly_burned_v1"
)

CANOPY_DISTURBANCE_ASSET = (
    "projects/mapbiomas-public/assets/brazil/lulc/"
    "collection10_1/"
    "mapbiomas_brazil_collection10_1_"
    "degradation_canopy_disturbance_frequency_v2"
)

MB_ALERTA_ASSET = (
    "projects/ee-ipam-cerrado/assets/ancillary/"
    "MBAlerta_2019-2025_v20260515_img_brasil"
)

YEARS = {
    "lulc": list(range(1985, 2026)),
    "secondary_vegetation": list(range(1987, 2026)),
    "secondary_vegetation_age": list(range(1987, 2026)),
    "fire": list(range(1985, 2026)),
    "canopy_disturbance": list(range(1988, 2025)),
    "native_mask_legacy": list(range(1985, 2026)),
}

ASSET_IDS = {
    "lulc": LULC_ASSET,
    "secondary_vegetation": DSV_ASSET,
    "secondary_vegetation_age": SECONDARY_AGE_ASSET,
    "fire": FIRE_MONTHLY_ASSET,
    "canopy_disturbance": CANOPY_DISTURBANCE_ASSET,
    "mapbiomas_alerta": MB_ALERTA_ASSET,
    "native_mask_legacy": LULC_ASSET,
}

BAND_TEMPLATES = {
    "lulc": "classification_{year}",
    "secondary_vegetation": "classification_{year}",
    "secondary_vegetation_age": "age_{year}",
    "fire": "burned_monthly_{year}",
    "canopy_disturbance": "canopy_disturbance_frequency_{year}",
    "native_mask_legacy": "classification_{year}",
}

GCS_DIRS = {
    "lulc": f"{GCS_TEMP_ROOT}/lulc",
    "secondary_vegetation": f"{GCS_TEMP_ROOT}/secondary_vegetation",
    "secondary_vegetation_age": f"{GCS_TEMP_ROOT}/secondary_vegetation_age",
    "fire": f"{GCS_TEMP_ROOT}/fire",
    "canopy_disturbance": f"{GCS_TEMP_ROOT}/canopy_disturbance",
    "mapbiomas_alerta": f"{GCS_TEMP_ROOT}/mapbiomas_alerta",

    # Legacy nativeMask was historically written directly under temp/.
    "native_mask_legacy": GCS_TEMP_ROOT,
}


# ============================================================
# 4. LEGACY NATIVE-MASK RULES
# ============================================================

# Preserved from the previous exporter for backwards compatibility.
native_classes = {
    "amazonia":       [3, 4, 5, 6, 11, 12, 49, 50],
    "caatinga":       [3, 4, 5, 11, 12, 49, 50, 77],
    "cerrado":        [3, 4, 5, 11, 12, 49, 50],
    "mata_atlantica": [3, 4, 5, 11, 12, 49, 50],
    "pampa":          [3, 4, 5, 11, 12, 49, 50, 84],
    "pantanal":       [3, 4, 5, 7, 11, 12, 49, 50],
}

ignore_classes = {
    "amazonia":       [13, 29, 32],
    "caatinga":       [13, 29, 32],
    "cerrado":        [13, 29, 32],
    "mata_atlantica": [13, 29, 32],
    "pampa":          [13, 29, 32],
    "pantanal":       [13, 29, 32, 33],
}

biomes_dict = {
    "amazonia":       1,
    "caatinga":       2,
    "cerrado":        3,
    "mata_atlantica": 4,
    "pampa":          5,
    "pantanal":       6,
}


# ============================================================
# 5. EE IMAGE HANDLES
# ============================================================

IMAGES = {
    key: ee.Image(asset_id)
    for key, asset_id in ASSET_IDS.items()
}

# Share the same object for the two LULC-based themes.
IMAGES["native_mask_legacy"] = IMAGES["lulc"]

biomes = ee.Image(BIOMES_ASSET)


# ============================================================
# 6. OUTPUT NAMING
# ============================================================

def output_name(theme, year=None):
    """Stable GCS/task name for one exported product."""

    if theme == "lulc":
        return f"lulc_{year}"

    if theme == "secondary_vegetation":
        return f"secondary_vegetation_{year}"

    if theme == "secondary_vegetation_age":
        return f"secondary_vegetation_age_{year}"

    if theme == "fire":
        return f"fire_monthly_{year}"

    if theme == "canopy_disturbance":
        return f"canopy_disturbance_{year}"

    if theme == "native_mask_legacy":
        return f"nativeMask-classification_{year}"

    if theme == "mapbiomas_alerta":
        return "mapbiomas_alerta_2019_2025"

    raise ValueError(f"Unknown theme: {theme}")


def file_prefix(theme, year=None):
    return (
        f"{GCS_DIRS[theme].rstrip('/')}/"
        f"{output_name(theme, year)}"
    )


# ============================================================
# 7. SOURCE / ANALYSIS TRANSFORMS
# ============================================================

def build_native_mask_year(year):
    """
    Legacy categorical nativeMask:
    eligible native + ignored/connectivity classes retain their
    ORIGINAL Collection 11 LULC values; all other pixels are masked.
    """

    band_name = f"classification_{year}"

    lulc = (
        IMAGES["lulc"]
        .select(band_name)
        .toUint8()
    )

    # Empty masked image with source projection/type.
    recipe = lulc.updateMask(
        ee.Image.constant(0)
    )

    for biome_name, biome_id in biomes_dict.items():

        classes_to_keep = (
            native_classes[biome_name]
            + ignore_classes[biome_name]
        )

        class_mask = (
            lulc
            .remap(
                classes_to_keep,
                [1] * len(classes_to_keep),
                defaultValue=0,
            )
            .eq(1)
        )

        biome_mask = biomes.eq(biome_id)

        piece = (
            lulc
            .updateMask(class_mask)
            .updateMask(biome_mask)
        )

        recipe = recipe.blend(piece)

    return (
        recipe
        .rename(band_name)
        .toUint8()
    )


def prepare_annual_export(theme, year):
    """
    Return:
        source_band       - original source band (for projection)
        export_image      - analysis-ready image written to GCS
        region            - source/analysis footprint
        nodata            - GeoTIFF NoData value
        semantic_note     - short description
    """

    band_name = BAND_TEMPLATES[theme].format(year=year)

    if theme == "native_mask_legacy":

        source_band = (
            IMAGES["lulc"]
            .select(band_name)
        )

        analysis = build_native_mask_year(year)

        return {
            "source_band": source_band,
            "export_image": analysis.unmask(0),
            "region": biomes.geometry(),
            "nodata": 0,
            "semantic_note": (
                "legacy biome-filtered nativeMask; "
                "original LULC classes retained"
            ),
        }

    source_band = IMAGES[theme].select(band_name)

    if theme == "lulc":

        analysis = (
            source_band
            .toUint8()
            .rename(band_name)
        )

        return {
            "source_band": source_band,
            "export_image": analysis.unmask(0),
            "region": IMAGES[theme].geometry(),
            "nodata": 0,
            "semantic_note": "original Collection 11 LULC class",
        }

    if theme == "secondary_vegetation":

        analysis = (
            source_band
            .toUint8()
            .rename(band_name)
        )

        return {
            "source_band": source_band,
            "export_image": analysis.unmask(0),
            "region": IMAGES[theme].geometry(),
            "nodata": 0,
            "semantic_note": "original DSV class 1-7",
        }

    if theme == "secondary_vegetation_age":

        # Official decoding rule supplied for this project:
        #     age = floor(raw / 100)
        #
        # Keep only positive packed source values as valid age pixels.
        analysis = (
            source_band
            .updateMask(source_band.gt(0))
            .divide(100)
            .floor()
            .toUint8()
            .rename(f"secondary_vegetation_age_{year}")
        )

        return {
            "source_band": source_band,
            "export_image": analysis.unmask(0),
            "region": IMAGES[theme].geometry(),
            "nodata": 0,
            "semantic_note": (
                "decoded secondary vegetation age: floor(raw/100)"
            ),
        }

    if theme == "fire":

        # 0 is deliberately preserved as a VALID no-burn value.
        # Reserve 255 as GeoTIFF NoData so 0 is never confused with NoData.
        analysis = (
            source_band
            .toUint8()
            .unmask(0)
            .rename(band_name)
        )

        return {
            "source_band": source_band,
            "export_image": analysis,
            "region": IMAGES[theme].geometry(),
            "nodata": 255,
            "semantic_note": (
                "0=no burn; 1-12=month assigned to burned pixel"
            ),
        }

    if theme == "canopy_disturbance":

        # Preserve the full source frequency information.
        # Valid source values 1..12 are exported unchanged.
        # Any desired binary mask should be derived locally:
        #     canopy_disturbed = canopy_frequency_raw > 1
        analysis = (
            source_band
            .toUint8()
            .rename(band_name)
        )

        return {
            "source_band": source_band,
            "export_image": analysis.unmask(0),
            "region": IMAGES[theme].geometry(),
            "nodata": 0,
            "semantic_note": (
                "original canopy disturbance frequency 1-12"
            ),
        }

    raise ValueError(f"Unsupported annual theme: {theme}")


def prepare_alerta_export():
    """
    Accumulated Brazil-wide MapBiomas Alerta assessment raster, 2019-2025.

    Keep 0 as a valid 'no mapped alert in period' value and 1 as
    'deforested sometime during 2019-2025'. Reserve 255 as GeoTIFF
    NoData outside the exported source footprint.

    This layer is intentionally kept as one accumulated period product.
    It must not be interpreted as annual year-of-loss information.
    """

    source = (
        IMAGES["mapbiomas_alerta"]
        .select("constant")
    )

    analysis = (
        source
        .eq(1)
        .toUint8()
        .unmask(0)
        .rename("alerta_2019_2025")
    )

    return {
        "source_band": source,
        "export_image": analysis,
        "region": IMAGES[
            "mapbiomas_alerta"
        ].geometry(),
        "nodata": 255,
        "semantic_note": (
            "Brazil accumulated binary MapBiomas Alerta: "
            "1=deforested sometime in 2019-2025; 0=no mapped alert"
        ),
    }


# ============================================================
# 8. EXPORT / RESUME HELPERS
# ============================================================

ACTIVE_EE_TASK_STATES = {
    "READY",
    "RUNNING",
    "PENDING",
    "SUBMITTED",
}

export_tasks = []
skipped_exports = []
forced_exports = []
planned_exports = []
new_tasks_started = 0


def format_options(nodata):
    options = {
        "noData": nodata,
    }

    if EXPORT_AS_COG:
        options["cloudOptimized"] = True

    return options


def source_projection_kwargs(image):
    """
    Preserve the exact source pixel lattice:
    CRS + affine transform. Do not use scale-based export.
    """

    info = (
        image
        .projection()
        .getInfo()
    )

    return {
        "crs": info["crs"],
        "crsTransform": info["transform"],
    }


def current_active_ee_tasks():

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
    Prefix-aware GCS existence test.

    EE may write:
        PREFIX.tif
    or sharded:
        PREFIX-0000000000-0000000000.tif
        PREFIX-...

    NOTE:
    Presence of at least one TIFF is used as the resumability signal.
    A failed partial export that
    left shards should be force-reexported explicitly.
    """

    if not CHECK_GCS_BEFORE_EXPORT:
        return None

    blobs = gcs_client.list_blobs(
        BUCKET_NAME,
        prefix=prefix,
    )

    for blob in blobs:

        lower = blob.name.lower()

        if (
            lower.endswith(".tif")
            or lower.endswith(".tiff")
        ):
            return blob.name

    return None


def is_forced(theme, year=None):

    if theme == "mapbiomas_alerta":
        return FORCE_REEXPORT_ALERTA

    return (
        year in FORCE_REEXPORT_YEARS.get(
            theme,
            [],
        )
    )


def should_submit(theme, year, description, prefix):

    if is_forced(theme, year):

        forced_exports.append({
            "theme": theme,
            "year": year,
            "description": description,
        })

        return True

    existing = first_existing_geotiff(prefix)

    if existing is not None:

        skipped_exports.append({
            "theme": theme,
            "year": year,
            "description": description,
            "reason": "GCS_EXISTS",
            "detail": existing,
        })

        print(
            f"{theme} {year if year is not None else ''}"
            " -> SKIP | GCS exists: "
            f"gs://{BUCKET_NAME}/{existing}"
        )

        return False

    active_state = active_ee_tasks.get(description)

    if active_state is not None:

        skipped_exports.append({
            "theme": theme,
            "year": year,
            "description": description,
            "reason": "ACTIVE_EE_TASK",
            "detail": active_state,
        })

        print(
            f"{theme} {year if year is not None else ''}"
            f" -> SKIP | EE task already {active_state}"
        )

        return False

    return True


def register_started_task(description, task):

    state = task.status().get(
        "state",
        "READY",
    )

    active_ee_tasks[description] = state


def task_cap_reached():
    return (
        MAX_NEW_TASKS is not None
        and new_tasks_started >= MAX_NEW_TASKS
    )


def submit_export(
    theme,
    prepared,
    year=None,
):

    global new_tasks_started

    description = output_name(theme, year)
    prefix = file_prefix(theme, year)

    planned_exports.append({
        "theme": theme,
        "year": year,
        "description": description,
        "prefix": prefix,
        "note": prepared["semantic_note"],
    })

    if not should_submit(
        theme,
        year,
        description,
        prefix,
    ):
        return

    if task_cap_reached():

        skipped_exports.append({
            "theme": theme,
            "year": year,
            "description": description,
            "reason": "MAX_NEW_TASKS",
            "detail": str(MAX_NEW_TASKS),
        })

        print(
            f"{theme} {year if year is not None else ''}"
            f" -> NOT SUBMITTED | MAX_NEW_TASKS={MAX_NEW_TASKS}"
        )

        return

    projection = source_projection_kwargs(
        prepared["source_band"]
    )

    export_args = dict(
        image=prepared["export_image"],
        description=description,
        bucket=BUCKET_NAME,
        fileNamePrefix=prefix,
        region=prepared["region"],
        crs=projection["crs"],
        crsTransform=projection["crsTransform"],
        maxPixels=MAX_PIXELS,
        fileFormat="GeoTIFF",
        formatOptions=format_options(
            prepared["nodata"]
        ),
    )

    if FILE_DIMENSIONS is not None:
        export_args.update({
            "shardSize": 256,
            "fileDimensions": FILE_DIMENSIONS,
        })

    if DRY_RUN:

        print(
            f"{theme} {year if year is not None else ''}"
            " -> DRY RUN | "
            f"gs://{BUCKET_NAME}/{prefix}*.tif"
        )

        return

    task = ee.batch.Export.image.toCloudStorage(
        **export_args
    )

    task.start()

    export_tasks.append({
        "theme": theme,
        "year": year,
        "description": description,
        "prefix": prefix,
        "task": task,
    })

    new_tasks_started += 1

    register_started_task(
        description,
        task,
    )

    print(
        f"{theme} {year if year is not None else ''}"
        " -> SUBMITTED | "
        f"gs://{BUCKET_NAME}/{prefix}*.tif"
    )


# ============================================================
# 9. SOURCE-BAND VALIDATION
# ============================================================

def validate_expected_bands():

    if not VALIDATE_SOURCE_BANDS:
        return

    annual_themes = [
        "lulc",
        "secondary_vegetation",
        "secondary_vegetation_age",
        "fire",
        "canopy_disturbance",
        "native_mask_legacy",
    ]

    # Avoid querying LULC twice if both LULC and nativeMask are enabled.
    checked_asset_ids = set()

    print()
    print("Validating source bands...")

    for theme in annual_themes:

        if not EXPORT_THEMES.get(theme, False):
            continue

        asset_id = ASSET_IDS[theme]

        if asset_id in checked_asset_ids:
            continue

        # All themes sharing this asset.
        related = [
            t
            for t in annual_themes
            if (
                EXPORT_THEMES.get(t, False)
                and ASSET_IDS[t] == asset_id
            )
        ]

        actual = set(
            ee.Image(asset_id)
            .bandNames()
            .getInfo()
        )

        for related_theme in related:

            expected = {
                BAND_TEMPLATES[
                    related_theme
                ].format(year=year)
                for year in YEARS[
                    related_theme
                ]
            }

            missing = sorted(expected - actual)

            if missing:
                raise RuntimeError(
                    f"{related_theme}: missing bands in "
                    f"{asset_id}: {missing[:10]}"
                    + (
                        " ..."
                        if len(missing) > 10
                        else ""
                    )
                )

            print(
                f"  OK {related_theme}: "
                f"{len(expected)} expected annual bands"
            )

        checked_asset_ids.add(asset_id)

    if EXPORT_THEMES.get(
        "mapbiomas_alerta",
        False,
    ):

        actual = set(
            IMAGES[
                "mapbiomas_alerta"
            ]
            .bandNames()
            .getInfo()
        )

        if "constant" not in actual:
            raise RuntimeError(
                "MapBiomas Alerta Brasil asset "
                "does not contain band 'constant'."
            )

        print(
            "  OK mapbiomas_alerta: "
            "band 'constant'"
        )


# ============================================================
# 10. PRINT EXPORT PLAN
# ============================================================

def print_plan():

    print()
    print("====================================================")
    print("COL11_V2 GCS EXPORTER v4.4")
    print("====================================================")
    print(f"GCP project: {GCP_PROJECT}")
    print(f"GCS bucket:  gs://{BUCKET_NAME}")
    print(f"GCS root:    {GCS_TEMP_ROOT}")
    print(f"DRY_RUN:     {DRY_RUN}")
    print()

    print("Themes:")

    for theme, enabled in EXPORT_THEMES.items():

        status = "ON " if enabled else "OFF"

        if theme in YEARS:
            years = YEARS[theme]
            coverage = f"{years[0]}-{years[-1]}"
        else:
            coverage = "2019-2025 accumulated"

        print(
            f"  [{status}] {theme:<28} {coverage}"
        )

    print("====================================================")
    print()


# ============================================================
# 11. RUN EXPORTS
# ============================================================

print_plan()
validate_expected_bands()

ANNUAL_EXPORT_ORDER = [
    "lulc",
    "secondary_vegetation",
    "secondary_vegetation_age",
    "fire",
    "canopy_disturbance",
    "native_mask_legacy",
]

for theme in ANNUAL_EXPORT_ORDER:

    if not EXPORT_THEMES.get(theme, False):
        continue

    print()
    print("----------------------------------------------------")
    print(f"THEME: {theme}")
    print("----------------------------------------------------")

    for year in YEARS[theme]:

        prepared = prepare_annual_export(
            theme,
            year,
        )

        submit_export(
            theme,
            prepared,
            year=year,
        )

if EXPORT_THEMES.get(
    "mapbiomas_alerta",
    False,
):

    print()
    print("----------------------------------------------------")
    print("THEME: mapbiomas_alerta")
    print("----------------------------------------------------")

    prepared = prepare_alerta_export()

    submit_export(
        "mapbiomas_alerta",
        prepared,
        year=None,
    )


# ============================================================
# 12. SUMMARY
# ============================================================

print()
print("====================================================")
print("EXPORT SUMMARY")
print("====================================================")

print(
    f"Planned items:       {len(planned_exports)}"
)
print(
    f"New tasks started:   {len(export_tasks)}"
)
print(
    f"Skipped items:       {len(skipped_exports)}"
)
print(
    f"Forced items:        {len(forced_exports)}"
)

if skipped_exports:

    reasons = {}

    for item in skipped_exports:
        reason = item["reason"]
        reasons[reason] = reasons.get(reason, 0) + 1

    print()
    print("Skipped by reason:")

    for reason in sorted(reasons):
        print(
            f"  {reason:<20} {reasons[reason]}"
        )

if export_tasks:

    print()
    print("Initial task status:")

    for item in export_tasks:

        status = item["task"].status()

        print(
            "  ",
            item["theme"],
            "|",
            item["year"],
            "|",
            item["description"],
            "|",
            status.get("state"),
        )

print()
print("GCS prefixes:")

for theme, enabled in EXPORT_THEMES.items():

    if not enabled:
        continue

    directory = GCS_DIRS[theme]

    print(
        f"  {theme:<28} "
        f"gs://{BUCKET_NAME}/{directory}/"
    )

print("====================================================")


# ============================================================
# 13. LOCAL DERIVATIVES — DO NOT EXPORT HERE
# ============================================================
#
# COL11_V2 should derive these after download/mosaic/grid validation:
#
# Secondary vegetation / fragmentation geometry
# ----------------------------
# vegetation = secondary vegetation classes in {2, 3, 5}
# connector  = biome-specific full-LULC connectivity classes
# analysis mask = vegetation OR connector
#
# Secondary vegetation age
# ------------------------
# Already decoded in exported raster:
#     age = floor(raw / 100)
#
# Fire monthly
# ------------
# annual burned       = fire_month > 0
# burned-year count   = cumulative count of years with fire_month > 0
# last fire year      = most recent burned year <= current year
# years since fire    = current year - last fire year
# rolling recurrence  = counts in previous 3 / 5 / 10 years
#
# Canopy disturbance
# ------------------
# Export preserves the original source frequency values 1-12.
# If a binary analysis layer is needed locally:
#     canopy_disturbed = canopy_frequency_raw > 1
# Do not use canopy disturbance to define fragment geometry.
#
# MapBiomas Alerta Brasil
# -----------------------
# Use as accumulated 2019-2025 corroboration / assessment,
# not as an annual year-of-loss product.
# ============================================================
