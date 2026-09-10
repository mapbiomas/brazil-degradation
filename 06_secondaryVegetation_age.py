"""
MapBiomas Degradation — Secondary Vegetation Age × Annual LULC
===============================================================

Builds and exports the annual age of secondary vegetation for MapBiomas
Collection 11, paired year-by-year with the actual annual LULC class from
the Collection 11 coverage product.

Workflow
--------
1. Read the Collection 11 deforestation/secondary-vegetation product.
2. For each year, define secondary vegetation as class 3 OR class 5.
3. Calculate consecutive age:
       current_age = (previous_age + 1) * current_secondary_mask
4. Mask age == 0.
5. Select the corresponding annual LULC band from Collection 11 coverage.
6. Rename LULC bands to the same `age_YEAR` names for explicit alignment.
7. Encode:
       output = secondary_vegetation_age * 100 + annual_lulc_class
8. Export to an Earth Engine asset on the exact Collection 11 pixel grid.

Default period
--------------
1987–2025 (39 annual bands)

Colab usage
-----------
Option A — edit DEFAULT_EE_PROJECT below, then:
    %run mapbiomas_secondary_vegetation_age_col11.py

Option B — leave the file unchanged:
    %run mapbiomas_secondary_vegetation_age_col11.py \
        --project YOUR_EE_PROJECT \
        --authenticate

Bash/pipeline usage
-------------------
Submit export and return immediately:
    python mapbiomas_secondary_vegetation_age_col11.py \
        --project "$EE_PROJECT"

Submit export and wait for completion:
    python mapbiomas_secondary_vegetation_age_col11.py \
        --project "$EE_PROJECT" \
        --wait

Run all QA/build steps without submitting:
    python mapbiomas_secondary_vegetation_age_col11.py \
        --project "$EE_PROJECT" \
        --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Dict, List, Optional, Tuple

import ee


# =============================================================================
# 0. DEFAULT CONFIGURATION
# =============================================================================

DEFAULT_EE_PROJECT = os.getenv(
    "EE_PROJECT",
    "mapbiomas-brazil",
)

DEFAULT_OUTPUT_ROOT = os.getenv(
    "OUTPUT_ROOT",
    "projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-11/public",
)

DEFAULT_START_YEAR = 1987
DEFAULT_END_YEAR = 2025

COLLECTION_ID = 11
DEFAULT_VERSION = 1

ENCODING_BASE = 100

SECONDARY_CLASS = 3
RECOVERY_CLASS = 5

MAX_PIXELS = 1e13
EXPORT_PRIORITY = 100

PYRAMIDING_POLICY = {
    ".default": "mode",
}


# =============================================================================
# 1. INPUT ASSETS
# =============================================================================

SECONDARY_VEGETATION_ASSET = (
    "projects/mapbiomas-public/assets/brazil/lulc/collection11/"
    "mapbiomas_brazil_collection11_deforestation_secondary_vegetation_v5"
)

COVERAGE_ASSET = (
    "projects/mapbiomas-public/assets/brazil/lulc/collection11/"
    "mapbiomas_brazil_collection11_coverage_v3"
)


# =============================================================================
# 2. COMMAND-LINE ARGUMENTS
# =============================================================================

def running_in_notebook() -> bool:
    """Return True when executed inside Jupyter/Colab."""
    return (
        "ipykernel" in sys.modules
        or "google.colab" in sys.modules
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build and export MapBiomas Collection 11 secondary-vegetation "
            "age crossed with paired annual Collection 11 LULC."
        )
    )

    parser.add_argument(
        "--project",
        default=DEFAULT_EE_PROJECT,
        help=(
            "Earth Engine-enabled Google Cloud project used for "
            "ee.Initialize(). Can also be supplied as EE_PROJECT."
        ),
    )

    parser.add_argument(
        "--output-root",
        default=DEFAULT_OUTPUT_ROOT,
        help=(
            "Earth Engine asset folder where the output image will be written. "
            "Can also be supplied as OUTPUT_ROOT."
        ),
    )

    parser.add_argument(
        "--start-year",
        type=int,
        default=DEFAULT_START_YEAR,
        help=f"First analysis year. Default: {DEFAULT_START_YEAR}.",
    )

    parser.add_argument(
        "--end-year",
        type=int,
        default=DEFAULT_END_YEAR,
        help=f"Last analysis year. Default: {DEFAULT_END_YEAR}.",
    )

    parser.add_argument(
        "--version",
        type=int,
        default=DEFAULT_VERSION,
        help=f"Output product version. Default: {DEFAULT_VERSION}.",
    )

    parser.add_argument(
        "--authenticate",
        action="store_true",
        help=(
            "Run ee.Authenticate() if initialization fails. "
            "In Colab this fallback is enabled automatically."
        ),
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Build and validate the Earth Engine image but do not submit "
            "the export task."
        ),
    )

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow the output image asset to be overwritten if it exists.",
    )

    parser.add_argument(
        "--wait",
        action="store_true",
        help=(
            "After starting the export, wait until the Earth Engine task "
            "finishes. Useful in bash pipelines."
        ),
    )

    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=60,
        help="Task-status polling interval used with --wait. Default: 60.",
    )

    # Jupyter/Colab injects its own arguments into sys.argv, typically:
    #
    #   -f /root/.local/share/jupyter/runtime/kernel-....json
    #
    # These are not arguments for this script. Ignore only those notebook
    # extras, while keeping strict argparse behavior for normal CLI/bash use.
    if running_in_notebook():
        args, unknown = parser.parse_known_args()

        if unknown:
            print(
                "Ignoring notebook/Jupyter arguments:",
                " ".join(unknown),
            )

        return args

    return parser.parse_args()


# =============================================================================
# 3. EARTH ENGINE INITIALIZATION
# =============================================================================

def running_in_colab() -> bool:
    """Return True when executed inside Google Colab."""
    try:
        import google.colab  # noqa: F401
        return True
    except Exception:
        return False


def initialize_earth_engine(
    project: str,
    authenticate: bool = False,
) -> None:
    """Initialize Earth Engine, with optional/Colab authentication fallback."""
    if not project or project == "YOUR_EARTH_ENGINE_CLOUD_PROJECT":
        raise ValueError(
            "Set an Earth Engine-enabled Cloud project with --project "
            "or the EE_PROJECT environment variable."
        )

    try:
        ee.Initialize(project=project)
    except Exception as exc:
        if authenticate or running_in_colab():
            print("Earth Engine initialization failed; authenticating...")
            ee.Authenticate()
            ee.Initialize(project=project)
        else:
            raise RuntimeError(
                "Earth Engine initialization failed. Authenticate the "
                "environment first or rerun with --authenticate."
            ) from exc

    print("=" * 78)
    print("EARTH ENGINE")
    print("=" * 78)
    print("Initialized project :", project)
    print("earthengine-api     :", ee.__version__)


# =============================================================================
# 4. BAND / QA HELPERS
# =============================================================================

def analysis_years(start_year: int, end_year: int) -> List[int]:
    """Return inclusive annual sequence."""
    if end_year < start_year:
        raise ValueError("end_year must be >= start_year.")
    return list(range(start_year, end_year + 1))


def classification_bands(years: List[int]) -> List[str]:
    """Return classification_YYYY band names."""
    return [f"classification_{year}" for year in years]


def output_age_bands(years: List[int]) -> List[str]:
    """Return age_YYYY output band names."""
    return [f"age_{year}" for year in years]


def validate_required_bands(
    image: ee.Image,
    required_bands: List[str],
    label: str,
) -> List[str]:
    """Validate that every requested source band exists."""
    available = image.bandNames().getInfo()
    missing = [band for band in required_bands if band not in available]
    unused = [band for band in available if band not in required_bands]

    print()
    print("=" * 78)
    print(label)
    print("=" * 78)
    print("Available bands :", len(available))
    print("Required bands  :", len(required_bands))
    print("Unused bands    :", len(unused))

    if missing:
        print("\nMISSING REQUIRED BANDS:")
        for band in missing:
            print("  -", band)
        raise ValueError(
            f"{label}: {len(missing)} required band(s) are missing."
        )

    print("Required bands  : OK")

    if unused:
        print("\nSource bands outside this recipe:")
        for band in unused:
            print("  -", band)

    return available


def validate_output_bands(
    image: ee.Image,
    expected_bands: List[str],
    label: str,
) -> None:
    """Ensure final band names and order are exactly as expected."""
    actual = image.bandNames().getInfo()

    if actual != expected_bands:
        raise ValueError(
            f"{label}: output band names/order are incorrect.\n"
            f"Expected: {expected_bands}\n"
            f"Actual:   {actual}"
        )

    print()
    print("-" * 78)
    print(label)
    print("-" * 78)
    print("Expected bands :", len(expected_bands))
    print("Actual bands   :", len(actual))
    print("First band     :", actual[0])
    print("Last band      :", actual[-1])
    print("Band alignment : OK")


# =============================================================================
# 5. REFERENCE GRID
# =============================================================================

def get_reference_grid(
    coverage: ee.Image,
    reference_band: str,
) -> Tuple[str, List[float]]:
    """Get exact Collection 11 CRS and affine transform."""
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
    print("REFERENCE GRID")
    print("=" * 78)
    print("Reference band :", reference_band)
    print("CRS            :", crs)
    print("Transform      :", transform)

    return crs, transform


# =============================================================================
# 6. SECONDARY VEGETATION AGE
# =============================================================================

def build_secondary_age(
    secondary_series: ee.Image,
    years: List[int],
) -> ee.Image:
    """
    Calculate consecutive annual secondary-vegetation age.

    Secondary state:
        source class == 3 OR source class == 5

    Recurrence:
        current_age = (previous_age + 1) * current_mask

    A normal Python loop builds the Earth Engine expression graph; raster
    computation remains server-side.
    """
    if not years:
        raise ValueError("At least one year is required.")

    first_source_band = f"classification_{years[0]}"

    # Initialize from the source raster so the running state inherits its
    # footprint/projection instead of beginning from an arbitrary constant grid.
    running_age = (
        secondary_series
        .select(first_source_band)
        .unmask(0)
        .multiply(0)
        .rename("running_age")
    )

    age_stack: Optional[ee.Image] = None

    for year in years:
        source_band = f"classification_{year}"
        output_band = f"age_{year}"

        current = (
            secondary_series
            .select(source_band)
            .unmask(0)
        )

        current_secondary = (
            current.eq(SECONDARY_CLASS)
            .Or(current.eq(RECOVERY_CLASS))
        )

        current_age = (
            running_age
            .add(1)
            .multiply(current_secondary)
            .rename(output_band)
        )

        if age_stack is None:
            age_stack = current_age
        else:
            age_stack = age_stack.addBands(current_age)

        running_age = current_age

    if age_stack is None:
        raise RuntimeError("Failed to construct secondary-vegetation age.")

    # Zero means the pixel is not secondary vegetation in that year.
    return age_stack.selfMask().int16()


# =============================================================================
# 7. PRODUCT BUILDER
# =============================================================================

def build_product(
    secondary_vegetation: ee.Image,
    coverage: ee.Image,
    start_year: int,
    end_year: int,
    version: int,
) -> Dict:
    """Build the secondary-vegetation-age × paired annual-LULC recipe."""
    years = analysis_years(start_year, end_year)
    source_bands = classification_bands(years)
    output_bands = output_age_bands(years)

    # Input QA.
    validate_required_bands(
        secondary_vegetation,
        source_bands,
        "SECONDARY VEGETATION INPUT",
    )
    validate_required_bands(
        coverage,
        source_bands,
        "COLLECTION 11 COVERAGE INPUT",
    )

    # Exact analysis period from secondary-vegetation product.
    secondary_series = secondary_vegetation.select(source_bands)

    # Actual annual Collection 11 LULC. Rename to age_YEAR so temporal pairing
    # is explicit before pixel arithmetic.
    lulc = (
        coverage
        .select(source_bands)
        .rename(output_bands)
    )

    # Consecutive age from classes 3 or 5.
    ages = build_secondary_age(
        secondary_series=secondary_series,
        years=years,
    )

    validate_output_bands(
        ages,
        output_bands,
        "SECONDARY VEGETATION AGE",
    )

    # Secondary vegetation controls only where age is valid. The encoded class
    # itself comes from paired annual Collection 11 coverage.
    lulc_secondary = lulc.updateMask(ages.mask())

    # encoded = age * 100 + annual LULC class
    recipe = (
        ages
        .multiply(ENCODING_BASE)
        .add(lulc_secondary)
        .int16()
    )

    properties = {
        "version": version,
        "product": "secondary_vegetation_age",
        "collection": COLLECTION_ID,
        "start_year": start_year,
        "end_year": end_year,
        "number_of_years": len(years),
        "encoding_base": ENCODING_BASE,
        "encoding": "secondary_vegetation_age * 100 + lulc_class",
        "secondary_class": SECONDARY_CLASS,
        "recovery_class": RECOVERY_CLASS,
        "age_definition": (
            "consecutive annual occurrence of secondary vegetation "
            "class 3 or recovery class 5"
        ),
        "source_secondary_vegetation": SECONDARY_VEGETATION_ASSET,
        "source_lulc": COVERAGE_ASSET,
    }

    recipe = recipe.set(properties)

    validate_output_bands(
        recipe,
        output_bands,
        "FINAL RECIPE",
    )

    print()
    print("=" * 78)
    print("PRODUCT BUILT SUCCESSFULLY")
    print("=" * 78)
    print(f"Period          : {start_year} → {end_year}")
    print(f"Number of bands : {len(years)}")
    print(f"Maximum age     : {len(years)}")
    print(f"Encoding        : age * {ENCODING_BASE} + annual LULC class")

    return {
        "image": recipe,
        "ages": ages,
        "lulc": lulc,
        "lulc_secondary": lulc_secondary,
        "secondary_series": secondary_series,
        "years": years,
        "source_bands": source_bands,
        "output_bands": output_bands,
        "properties": properties,
    }


# =============================================================================
# 8. EXPORT
# =============================================================================

def output_description(collection_id: int, version: int) -> str:
    return f"degradation_secondaryVegetation_col{collection_id}_v{version}"


def asset_exists(asset_id: str) -> bool:
    """Check whether a destination EE asset already exists."""
    try:
        ee.data.getAsset(asset_id)
        return True
    except Exception:
        return False


def create_export_task(
    image: ee.Image,
    region: ee.Geometry,
    output_root: str,
    version: int,
    export_crs: str,
    export_transform: List[float],
    overwrite: bool = False,
) -> Tuple[ee.batch.Task, str]:
    """Create, but do not start, the Earth Engine asset export task."""
    description = output_description(
        collection_id=COLLECTION_ID,
        version=version,
    )

    asset_id = f"{output_root.rstrip('/')}/{description}"

    if asset_exists(asset_id) and not overwrite:
        raise FileExistsError(
            f"Destination asset already exists:\n{asset_id}\n"
            "Use --overwrite only if replacement is intentional."
        )

    task = ee.batch.Export.image.toAsset(
        image=image,
        description=description,
        assetId=asset_id,
        region=region,
        # Exact Collection 11 pixel grid; do not also specify scale.
        crs=export_crs,
        crsTransform=export_transform,
        pyramidingPolicy=PYRAMIDING_POLICY,
        maxPixels=MAX_PIXELS,
        priority=EXPORT_PRIORITY,
        overwrite=overwrite,
    )

    return task, asset_id


def show_task_status(task: ee.batch.Task, asset_id: str) -> Dict:
    """Print and return current export-task status."""
    status = task.status()

    print()
    print("=" * 78)
    print("EXPORT STATUS")
    print("=" * 78)
    print("State       :", status.get("state"))
    print("Task ID     :", status.get("id"))
    print("Description :", status.get("description"))
    print("Asset       :", asset_id)

    error = status.get("error_message")
    if error:
        print("ERROR       :", error)

    return status


def wait_for_task(
    task: ee.batch.Task,
    asset_id: str,
    poll_seconds: int = 60,
) -> Dict:
    """Wait for task completion; useful when called from a bash pipeline."""
    terminal_states = {
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "CANCELED",
    }

    while True:
        status = task.status()
        state = status.get("state", "UNKNOWN")

        print(
            f"[secondary vegetation] task={task.id} state={state}",
            flush=True,
        )

        if state in terminal_states:
            show_task_status(task, asset_id)
            return status

        time.sleep(max(1, poll_seconds))


# =============================================================================
# 9. MAIN
# =============================================================================

def main() -> int:
    args = parse_args()

    initialize_earth_engine(
        project=args.project,
        authenticate=args.authenticate,
    )

    print()
    print("=" * 78)
    print("CONFIGURATION")
    print("=" * 78)
    print("Secondary asset :", SECONDARY_VEGETATION_ASSET)
    print("Coverage asset  :", COVERAGE_ASSET)
    print("Output root     :", args.output_root)
    print("Period          :", f"{args.start_year}–{args.end_year}")
    print("Version         :", args.version)
    print("Dry run         :", args.dry_run)
    print("Overwrite       :", args.overwrite)
    print("Wait            :", args.wait)

    secondary_vegetation = ee.Image(SECONDARY_VEGETATION_ASSET)
    coverage = ee.Image(COVERAGE_ASSET)
    region = coverage.geometry()

    # Match exports to the requested final-year Collection 11 grid.
    grid_reference_band = f"classification_{args.end_year}"

    validate_required_bands(
        coverage,
        [grid_reference_band],
        "EXPORT GRID REFERENCE",
    )

    export_crs, export_transform = get_reference_grid(
        coverage=coverage,
        reference_band=grid_reference_band,
    )

    result = build_product(
        secondary_vegetation=secondary_vegetation,
        coverage=coverage,
        start_year=args.start_year,
        end_year=args.end_year,
        version=args.version,
    )

    if args.dry_run:
        print()
        print("=" * 78)
        print("DRY RUN COMPLETE")
        print("=" * 78)
        print("QA passed. No Earth Engine export task was submitted.")
        return 0

    task, asset_id = create_export_task(
        image=result["image"],
        region=region,
        output_root=args.output_root,
        version=args.version,
        export_crs=export_crs,
        export_transform=export_transform,
        overwrite=args.overwrite,
    )

    task.start()

    print()
    print("=" * 78)
    print("EXPORT SUBMITTED")
    print("=" * 78)
    print("Task ID :", task.id)
    print("Asset   :", asset_id)

    if not args.wait:
        show_task_status(task, asset_id)
        return 0

    final_status = wait_for_task(
        task=task,
        asset_id=asset_id,
        poll_seconds=args.poll_seconds,
    )

    if final_status.get("state") == "COMPLETED":
        print("\nExport completed successfully.")
        return 0

    print(
        f"\nExport ended with state={final_status.get('state')}.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    exit_code = main()

    # In a notebook, raising SystemExit is noisy and may be displayed as an
    # exception even when the code is 0. In bash/CLI we still propagate the
    # exit status so pipelines can fail correctly.
    if running_in_notebook():
        if exit_code != 0:
            raise RuntimeError(
                f"Workflow failed with exit code {exit_code}."
            )
    else:
        sys.exit(exit_code)
