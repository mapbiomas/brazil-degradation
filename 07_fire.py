#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MapBiomas Degradation — Fire Metrics × Native Coverage
======================================================

Builds and exports two annual degradation products using the Google Earth
Engine Python API:

1) Fire frequency × annual native vegetation
2) Time since last fire (fire age) × annual native vegetation

Inputs
------
- MapBiomas LULC Collection 11
- MapBiomas Fire Collection 5

Encoding
--------
    output = fire_metric * 100 + lulc_class

Examples
--------
    3    = metric 0, native class 3
    103  = metric 1, native class 3
    503  = metric 5, native class 3
    1284 = metric 12, native class 84

Important product semantics
---------------------------
Frequency:
    - Period: 1985–2025
    - Source bands: fire_frequency_1985_YEAR
    - Fire frequency is unmasked to 0 before crossing with annual native cover.

Age:
    - Period: 1986–2025
    - Source bands: classification_YEAR
    - Source mask is preserved. Pixels without valid fire-age information
      remain masked.

Both outputs:
    - Annual LULC and fire metric bands are explicitly aligned by year.
    - Non-native annual LULC pixels are masked.
    - Encoded values are stored as int16.
    - Export uses mode pyramiding.
    - Export grid is copied from the Collection 11 LULC reference band.

Usage in Google Colab
---------------------
1. Upload/open this file in Colab.
2. Set EE_PROJECT below to an Earth Engine-enabled Google Cloud project.
3. Ensure your account can write to OUTPUT_ROOT.
4. Run the script.

If needed in Colab, update the Earth Engine API first:
    !pip install -U earthengine-api

Authors / contacts inherited from the original workflow
-------------------------------------------------------
IPAM
wallace.silva@ipam.org.br

Issues / bugs:
dhemerson.costa@ipam.org.br
mrosa@arcplan.com.br
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import ee


# =============================================================================
# 0. USER CONFIGURATION
# =============================================================================

# Google Cloud project used to initialize Earth Engine.
# Replace this before running.
EE_PROJECT = "mapbiomas-brazil"

# Destination root.
OUTPUT_ROOT = (
    "projects/mapbiomas-brazil/assets/"
    "DEGRADATION/COLLECTION-11/public"
)

# Submit exports automatically when the script reaches main().
START_EXPORTS = True

# If True, Earth Engine may replace an existing destination image asset.
# Requires earthengine-api >= 1.7.3.
OVERWRITE = False

MAX_PIXELS = 1e13

# Encoded categorical outputs should use mode pyramiding.
PYRAMIDING_POLICY = {".default": "mode"}

# The exact export CRS and affine transform are copied from this band.
GRID_REFERENCE_BAND = "classification_2025"


# =============================================================================
# 1. COLLECTION CONFIGURATION
# =============================================================================

LULC_COLLECTION = 11
FIRE_COLLECTION = 5

ENCODING_BASE = 100

NATIVE_CLASSES = [
    3, 4, 5, 6, 7,
    11, 12,
    49, 50,
    77, 84,
]

COVERAGE_ASSET = (
    "projects/mapbiomas-public/assets/brazil/lulc/collection11/"
    "mapbiomas_brazil_collection11_coverage_v3"
)

FREQUENCY_ASSET = (
    "projects/mapbiomas-public/assets/brazil/fire/collection5/"
    "mapbiomas_fire_collection5_fire_frequency_v1"
)

AGE_ASSET = (
    "projects/mapbiomas-public/assets/brazil/fire/collection5/"
    "mapbiomas_fire_collection5_time_after_fire_v1"
)


# =============================================================================
# 2. PRODUCT CONFIGURATION
# =============================================================================

PRODUCTS: Dict[str, Dict] = {
    "frequency": {
        "product": "frequency",
        "version": 1,
        "start_year": 1985,
        "end_year": 2025,
        "source_asset": FREQUENCY_ASSET,
        "source_band_pattern": "fire_frequency_1985_{year}",
        "output_band_pattern": "fire_frequency_{year}",
        "unmask_value": 0,
        "encoding": "fire_frequency * 100 + lulc_class",
        "description": "degradation_fireFrequency_col11_v1",
        "mask_semantics": (
            "fire frequency unmasked to zero; "
            "output masked by annual native vegetation"
        ),
    },
    "age": {
        "product": "age",
        "version": 1,
        "start_year": 1986,
        "end_year": 2025,
        "source_asset": AGE_ASSET,
        "source_band_pattern": "classification_{year}",
        "output_band_pattern": "age_{year}",
        "unmask_value": None,
        "encoding": "fire_age * 100 + lulc_class",
        "description": "degradation_fireAge_col11_v1",
        "mask_semantics": (
            "source fire-age mask preserved; "
            "output requires valid fire age and annual native vegetation"
        ),
    },
}


# =============================================================================
# 3. EARTH ENGINE INITIALIZATION
# =============================================================================

def initialize_earth_engine(project: str) -> None:
    """Authenticate and initialize the Earth Engine Python API."""
    if not project or project == "YOUR_EARTH_ENGINE_CLOUD_PROJECT":
        raise ValueError(
            "Set EE_PROJECT to an Earth Engine-enabled Google Cloud project "
            "before running this script."
        )

    try:
        ee.Initialize(project=project)
    except Exception:
        ee.Authenticate()
        ee.Initialize(project=project)

    print("Earth Engine initialized.")
    print("earthengine-api version:", ee.__version__)
    print("Cloud project:", project)


# =============================================================================
# 4. HELPERS
# =============================================================================

def years_for(config: Dict) -> List[int]:
    """Return the inclusive analysis years for one product."""
    return list(range(config["start_year"], config["end_year"] + 1))


def make_band_names(pattern: str, years: List[int]) -> List[str]:
    """Expand a {year} band-name pattern."""
    return [pattern.format(year=year) for year in years]


def validate_required_bands(
    image: ee.Image,
    required_bands: List[str],
    label: str,
) -> List[str]:
    """
    Validate source metadata before building/exporting.

    Only band metadata is transferred client-side. No raster data are
    downloaded.
    """
    available = image.bandNames().getInfo()

    missing = [band for band in required_bands if band not in available]
    unused = [band for band in available if band not in required_bands]

    print()
    print("=" * 78)
    print(label)
    print("=" * 78)
    print(f"Available bands : {len(available)}")
    print(f"Required bands  : {len(required_bands)}")
    print(f"Unused bands    : {len(unused)}")

    if missing:
        print("\nMISSING REQUIRED BANDS:")
        for band in missing:
            print("  -", band)
        raise ValueError(
            f"{label}: {len(missing)} required band(s) are missing."
        )

    print("Required bands  : OK")

    if unused:
        print("\nBands present in the source asset but unused by this recipe:")
        for band in unused:
            print("  -", band)

    return available


def build_native_coverage(lulc: ee.Image) -> ee.Image:
    """
    Preserve annual LULC class IDs only where the class is native vegetation.

    `lulc` may contain many annual bands. The mask has the same band structure.
    """
    native_mask = lulc.eq(NATIVE_CLASSES[0])

    for class_id in NATIVE_CLASSES[1:]:
        native_mask = native_mask.Or(lulc.eq(class_id))

    return lulc.updateMask(native_mask)


def build_product(
    coverage: ee.Image,
    config: Dict,
) -> Dict:
    """
    Build one fire metric × annual native-cover image.

    Both operands are explicitly selected and renamed to the same annual output
    band names before any pixel arithmetic occurs.
    """
    years = years_for(config)

    coverage_bands = [
        f"classification_{year}"
        for year in years
    ]

    source_bands = make_band_names(
        config["source_band_pattern"],
        years,
    )

    output_bands = make_band_names(
        config["output_band_pattern"],
        years,
    )

    source_image = ee.Image(config["source_asset"])

    # -------------------------------------------------------------------------
    # Input QA
    # -------------------------------------------------------------------------
    validate_required_bands(
        coverage,
        coverage_bands,
        f"LULC input — {config['product']}",
    )

    validate_required_bands(
        source_image,
        source_bands,
        f"Fire input — {config['product']}",
    )

    # -------------------------------------------------------------------------
    # Explicit temporal alignment
    # -------------------------------------------------------------------------
    lulc = (
        coverage
        .select(coverage_bands)
        .rename(output_bands)
    )

    fire_metric = (
        source_image
        .select(source_bands)
        .rename(output_bands)
    )

    # Frequency uses 0 for no recorded previous fire.
    # Fire age keeps its original source mask.
    if config["unmask_value"] is not None:
        fire_metric = fire_metric.unmask(config["unmask_value"])

    # -------------------------------------------------------------------------
    # Annual native vegetation
    # -------------------------------------------------------------------------
    native_coverage = build_native_coverage(lulc)

    # -------------------------------------------------------------------------
    # Encoding
    # -------------------------------------------------------------------------
    encoded = (
        fire_metric
        .multiply(ENCODING_BASE)
        .add(native_coverage)
        .int16()
    )

    # -------------------------------------------------------------------------
    # Metadata
    # -------------------------------------------------------------------------
    properties = {
        "version": config["version"],
        "product": config["product"],
        "start_year": config["start_year"],
        "end_year": config["end_year"],
        "lulc_collection": LULC_COLLECTION,
        "fire_collection": FIRE_COLLECTION,
        "encoding_base": ENCODING_BASE,
        "encoding": config["encoding"],
        "native_classes": ",".join(str(x) for x in NATIVE_CLASSES),
        "mask_semantics": config["mask_semantics"],
        "source_lulc": COVERAGE_ASSET,
        "source_fire": config["source_asset"],
    }

    recipe = encoded.set(properties)

    # -------------------------------------------------------------------------
    # Output QA
    # -------------------------------------------------------------------------
    actual_output_bands = recipe.bandNames().getInfo()

    if actual_output_bands != output_bands:
        raise ValueError(
            f"{config['product']}: output band names/order do not match "
            "the expected annual sequence."
        )

    print()
    print("-" * 78)
    print("PRODUCT BUILT:", config["product"])
    print("-" * 78)
    print(f"Period         : {config['start_year']} → {config['end_year']}")
    print(f"Expected bands : {len(output_bands)}")
    print(f"Actual bands   : {len(actual_output_bands)}")
    print(f"First band     : {actual_output_bands[0]}")
    print(f"Last band      : {actual_output_bands[-1]}")
    print("Band alignment : OK")

    return {
        "image": recipe,
        "lulc": lulc,
        "fire_metric": fire_metric,
        "native_coverage": native_coverage,
        "years": years,
        "coverage_bands": coverage_bands,
        "source_bands": source_bands,
        "output_bands": output_bands,
        "config": config,
    }


def get_reference_grid(
    coverage: ee.Image,
    reference_band: str,
) -> Tuple[str, List[float]]:
    """
    Read the exact CRS and affine transform from the MapBiomas LULC grid.
    """
    projection = (
        coverage
        .select(reference_band)
        .projection()
        .getInfo()
    )

    crs = projection["crs"]
    transform = projection["transform"]

    print()
    print("=" * 78)
    print("MAPBIOMAS REFERENCE GRID")
    print("=" * 78)
    print("Reference band:", reference_band)
    print("CRS           :", crs)
    print("Transform     :", transform)

    return crs, transform


def create_export_task(
    product_result: Dict,
    region: ee.Geometry,
    export_crs: str,
    export_transform: List[float],
) -> Tuple[ee.batch.Task, str]:
    """Create, but do not start, an Earth Engine image-to-asset export."""
    config = product_result["config"]
    image = product_result["image"]

    description = config["description"]
    asset_id = f"{OUTPUT_ROOT}/{description}"

    task = ee.batch.Export.image.toAsset(
        image=image,
        description=description,
        assetId=asset_id,
        region=region,
        crs=export_crs,
        crsTransform=export_transform,
        pyramidingPolicy=PYRAMIDING_POLICY,
        maxPixels=MAX_PIXELS,
        overwrite=OVERWRITE
    )

    return task, asset_id


def start_exports(
    products: Dict[str, Dict],
    region: ee.Geometry,
    export_crs: str,
    export_transform: List[float],
) -> Dict[str, Dict]:
    """Create and start one export task per configured product."""
    tasks: Dict[str, Dict] = {}

    for product_name in PRODUCTS:
        task, asset_id = create_export_task(
            product_result=products[product_name],
            region=region,
            export_crs=export_crs,
            export_transform=export_transform,
        )

        task.start()

        tasks[product_name] = {
            "task": task,
            "asset_id": asset_id,
        }

        print()
        print("-" * 78)
        print("EXPORT STARTED:", product_name)
        print("-" * 78)
        print("Task ID :", task.id)
        print("Asset   :", asset_id)

    return tasks


def show_export_status(tasks: Dict[str, Dict]) -> None:
    """Print the current state of each submitted export task."""
    print()
    print("=" * 78)
    print("EXPORT STATUS")
    print("=" * 78)

    for product_name, item in tasks.items():
        status = item["task"].status()

        print()
        print(product_name.upper())
        print("  state       :", status.get("state"))
        print("  task id     :", status.get("id"))
        print("  description :", status.get("description"))
        print("  asset       :", item["asset_id"])

        error = status.get("error_message")
        if error:
            print("  ERROR       :", error)


def print_decoding_examples() -> None:
    """Document the common encoding used by both exported products."""
    print()
    print("=" * 78)
    print("ENCODING / DECODING")
    print("=" * 78)
    print(f"encoded = metric * {ENCODING_BASE} + lulc_class")
    print()
    print("Earth Engine decoding expressions:")
    print(f"  metric     = encoded.divide({ENCODING_BASE}).floor()")
    print(f"  lulc_class = encoded.mod({ENCODING_BASE})")


# =============================================================================
# 5. MAIN WORKFLOW
# =============================================================================

def main() -> Dict[str, Dict]:
    initialize_earth_engine(EE_PROJECT)

    coverage = ee.Image(COVERAGE_ASSET)
    region = coverage.geometry()

    # Exact MapBiomas LULC pixel grid.
    export_crs, export_transform = get_reference_grid(
        coverage,
        GRID_REFERENCE_BAND,
    )

    # Build both products server-side.
    products: Dict[str, Dict] = {}

    for product_name, config in PRODUCTS.items():
        products[product_name] = build_product(
            coverage=coverage,
            config=config,
        )

    print()
    print("=" * 78)
    print("ALL PRODUCTS BUILT SUCCESSFULLY")
    print("=" * 78)

    for product_name, result in products.items():
        print(
            f"{product_name:10s}: "
            f"{len(result['output_bands'])} bands, "
            f"{result['output_bands'][0]} → {result['output_bands'][-1]}"
        )

    print_decoding_examples()

    # -------------------------------------------------------------------------
    # Exports
    # -------------------------------------------------------------------------
    if START_EXPORTS:
        tasks = start_exports(
            products=products,
            region=region,
            export_crs=export_crs,
            export_transform=export_transform,
        )

        show_export_status(tasks)

        print()
        print("=" * 78)
        print("EXPORT TASKS SUBMITTED")
        print("=" * 78)
        print(
            "The Earth Engine batch tasks are now visible in the Tasks/"
            "Operations interface."
        )

        return tasks

    print()
    print("=" * 78)
    print("EXPORTS NOT STARTED")
    print("=" * 78)
    print("START_EXPORTS is False. Products passed QA but no tasks were submitted.")

    return {}


if __name__ == "__main__":
    main()
