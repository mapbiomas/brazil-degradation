# ============================================================
# ECOSYSTEM FRAGMENTATION - EDGE AREA
# GT Degradação - MapBiomas
#
# Any issue, bug or report:
# dhemerson.costa@ipam.org.br
# mrosa@arcplan.com.br
# ============================================================

import ee

# ============================================================
# 1. EARTH ENGINE INITIALIZATION
# ============================================================

# Uncomment when running interactively in Colab for the first time:
ee.Authenticate()

EE_PROJECT = 'mapbiomas-brazil'
ee.Initialize(project=EE_PROJECT)

print('Earth Engine initialized.')


# ============================================================
# 2. VERSION / OUTPUT
# ============================================================

collection_id = 11
version = 1

file_name = (
    f'degradation_edge_area_col{collection_id}_v{version}'
)

asset_id = (
    'projects/mapbiomas-brazil/assets/'
    'DEGRADATION/COLLECTION-11/public/'
    + file_name
)


# ============================================================
# 3. PARAMETERS
# ============================================================

# Native vegetation classes in which edge area will be applied.
#
# 3  = Forest Formation
# 4  = Savanna Formation
# 5  = Mangrove
# 6  = Flooded Forest
# 11 = Wetland
# 12 = Grassland Formation
#
# Additional biome-specific classes are retained according to
# the original MapBiomas degradation workflow.

native_classes = {
    'amazonia':       [3, 4, 5, 6, 11, 12, 49, 50],
    'caatinga':       [3, 4, 5, 11, 12, 49, 50, 77],
    'cerrado':        [3, 4, 5, 11, 12, 49, 50],
    'mata_atlantica': [3, 4, 5, 11, 12, 49, 50],
    'pampa':          [3, 4, 5, 11, 12, 49, 50, 84],
    'pantanal':       [3, 4, 5, 7, 11, 12, 49, 50],
}


# Classes to be ignored. These classes do not produce edge area.
#
# 13 = Other Non-Forest Natural Formation
# 29 = Rocky Outcrop
# 32 = Hypersaline Tidal Flat
# 33 = Water

ignore_classes = {
    'amazonia':       [13, 29, 32, 33],
    'caatinga':       [13, 29, 32, 33],
    'cerrado':        [13, 29, 32, 33],
    'mata_atlantica': [13, 29, 32, 33],
    'pampa':          [13, 29, 32, 33],
    'pantanal':       [13, 29, 32, 33],
}


# Years to process
years_list = list(range(1985, 2026))


# Edge-effect parameters
kernel_radius_m = 7500
max_edge_distance_m = 7000
distance_step_m = 30


# ============================================================
# 4. INPUT DATA
# ============================================================

# Biomes
biomes = ee.Image(
    'projects/mapbiomas-workspace/'
    'AUXILIAR/biome_2025_buf5k_30m'
)

biomes_name = [
    'amazonia',
    'caatinga',
    'cerrado',
    'mata_atlantica',
    'pampa',
    'pantanal',
]

biomes_dict = {
    'amazonia':       1,
    'caatinga':       2,
    'cerrado':        3,
    'mata_atlantica': 4,
    'pampa':          5,
    'pantanal':       6,
}


# MapBiomas Collection 11
collection_all = ee.Image(
    'projects/mapbiomas-public/assets/brazil/lulc/'
    'collection11/'
    'mapbiomas_brazil_collection11_coverage_v3'
)


# ============================================================
# 5. BUILD EDGE-DEGRADATION PRODUCT
# ============================================================

recipe = ee.Image([])

for year_j in years_list:

    print(f'Building graph for {year_j}...')

    # --------------------------------------------------------
    # Annual classification
    # --------------------------------------------------------

    collection = collection_all.select(
        f'classification_{year_j}'
    )

    # --------------------------------------------------------
    # Empty masked image preserving the MapBiomas source grid
    # --------------------------------------------------------

    edge_degrad_year = (
        collection
        .multiply(0)
        .selfMask()
    )

    # --------------------------------------------------------
    # Process each biome separately
    # --------------------------------------------------------

    for biome_k in biomes_name:

        # Native + ignored classes retain their original class
        # values. All other classes become 21 (anthropogenic).
        remap_classes = (
            native_classes[biome_k]
            + ignore_classes[biome_k]
        )

        native_mask = (
            collection
            .remap(
                remap_classes,
                remap_classes,
                defaultValue=21
            )
            .updateMask(
                biomes.eq(
                    biomes_dict[biome_k]
                )
            )
        )

        # ----------------------------------------------------
        # Retain native + ignored raw classes
        # ----------------------------------------------------

        collection_i = (
            collection
            .updateMask(
                native_mask.neq(21)
            )
        )

        # ----------------------------------------------------
        # Anthropogenic pixels = source/reference for distance
        # ----------------------------------------------------

        anthropogenic = (
            native_mask
            .updateMask(
                native_mask.eq(21)
            )
        )

        # ----------------------------------------------------
        # Euclidean distance to nearest anthropogenic pixel
        # ----------------------------------------------------

        edge = anthropogenic.distance(
            ee.Kernel.euclidean(
                kernel_radius_m,
                'meters'
            ),
            False
        )

        # ----------------------------------------------------
        # Remove edge values over ignored classes
        # ----------------------------------------------------

        for class_m in ignore_classes[biome_k]:
            edge = edge.updateMask(
                collection_i.neq(class_m)
            )

        # ----------------------------------------------------
        # Restrict RAW Euclidean distance to <= 7 km
        #
        # Important:
        # This happens BEFORE quantization to 30-m steps.
        # ----------------------------------------------------

        edge = edge.updateMask(
            edge.lte(max_edge_distance_m)
        )

        # ----------------------------------------------------
        # Merge biome result into annual edge image
        # ----------------------------------------------------

        edge_degrad_year = (
            edge_degrad_year
            .blend(edge)
            .selfMask()
        )

    # --------------------------------------------------------
    # Quantize distances to nearest 30-m step
    #
    # Examples:
    #   31   -> 30
    #   44   -> 30
    #   46   -> 60
    #   101  -> 90
    #   119  -> 120
    #   7000 -> 6990
    # --------------------------------------------------------

    edge_degrad_year = (
        edge_degrad_year
        .divide(distance_step_m)
        .round()
        .multiply(distance_step_m)
        .int16()
        .rename(f'edge_{year_j}')
    )

    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------

    edge_degrad_year = (
        edge_degrad_year
        .set('territory', 'BRAZIL')
        .set('collection_id', collection_id)
        .set('version', version)
        .set('year', year_j)
        .set('description', 'EDGE AREA')
    )

    # --------------------------------------------------------
    # Add annual band to multiband output
    # --------------------------------------------------------

    recipe = recipe.addBands(
        edge_degrad_year
    )


# Standardize datatype
recipe = recipe.int16()

print('Earth Engine graph completed.')


# ============================================================
# 6. BASIC QA
# ============================================================

print('\n--- BASIC QA ---')

print(
    'Number of bands:',
    recipe.bandNames().size().getInfo()
)

print(
    'Band names:',
    recipe.bandNames().getInfo()
)

print(
    'Band types:',
    recipe.bandTypes().getInfo()
)


# ============================================================
# 7. PROJECTION QA
# ============================================================

print('\n--- PROJECTION QA ---')

reference = collection_all.select(
    'classification_1985'
)

input_projection = (
    reference
    .projection()
    .getInfo()
)

output_projection = (
    recipe
    .select('edge_1985')
    .projection()
    .getInfo()
)

input_scale = (
    reference
    .projection()
    .nominalScale()
    .getInfo()
)

output_scale = (
    recipe
    .select('edge_1985')
    .projection()
    .nominalScale()
    .getInfo()
)

print('Input projection:')
print(input_projection)

print('\nOutput projection:')
print(output_projection)

print('\nInput nominal scale:')
print(input_scale)

print('\nOutput nominal scale:')
print(output_scale)


# ============================================================
# 8. NUMERICAL QA
# ============================================================

# Set to False if you want to skip the national reduceRegion
# checks and submit the export immediately.
RUN_NUMERICAL_QA = True

if RUN_NUMERICAL_QA:

    print('\n--- NUMERICAL QA ---')

    qa_year = 2025
    qa = recipe.select(f'edge_{qa_year}')

    # Minimum / maximum
    qa_minmax = qa.reduceRegion(
        reducer=ee.Reducer.minMax(),
        geometry=biomes.geometry(),
        scale=30,
        maxPixels=1e13,
        tileScale=4
    )

    print(
        f'{qa_year} min/max:',
        qa_minmax.getInfo()
    )

    # Every valid value should be divisible by 30.
    qa_modulo = (
        qa
        .mod(distance_step_m)
        .reduceRegion(
            reducer=ee.Reducer.max(),
            geometry=biomes.geometry(),
            scale=30,
            maxPixels=1e13,
            tileScale=4
        )
    )

    print(
        f'{qa_year} maximum modulo {distance_step_m}:',
        qa_modulo.getInfo()
    )


# ============================================================
# 9. EXPORT
# ============================================================

# Change to False if you only want to build / QA the product.
START_EXPORT = True

if START_EXPORT:

    print('\n--- EXPORT ---')

    task = ee.batch.Export.image.toAsset(
        image=recipe,
        description=file_name,
        assetId=asset_id,
        region=biomes.geometry(),
        scale=30,
        pyramidingPolicy={
            '.default': 'sample'
        },
        maxPixels=1e13,
        priority=999
    )

    task.start()

    print('Export submitted.')
    print('Description:', file_name)
    print('Asset ID:', asset_id)
    print('Task ID:', task.id)

    status = task.status()

    print('Initial task state:', status.get('state'))

else:
    print('\nExport not submitted (START_EXPORT=False).')
