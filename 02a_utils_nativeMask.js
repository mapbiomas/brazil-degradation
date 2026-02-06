// native vegetation mask to compute on LSMetrics // gt degradaçao - mapbiomas //
// any issue, bug or report write to dhemerson.costa@ipam.org.br and/or mrosa@arcplan.com.br

// set version
var version = 1;

// -- * definitions
// 3 (forest), 4 (savanna), 5 (mangrove), 6 (flooded forest), 11 (wetland), 12 (grassland)
var native_classes = {
  'amazonia':       [3, 4, 5, 6, 11, 12, 49, 50],
  'caatinga':       [3, 4, 5, 11, 12, 49, 50],
  'cerrado':        [3, 4, 5, 11, 12, 49, 50],
  'mata_atlantica': [3, 4, 5, 11, 12, 49, 50],
  'pampa':          [3, 4, 5, 11, 12, 49, 50],
  'pantanal':       [3, 4, 5, 11, 12, 49, 50]
};

// dset classes to be ignored (which doesn't fragment native vegetation)
// 13 (other non forest), 29 (rocky outcrop), 32 (hypersaline tidal flat), 33 (water)
var ignore_classes = {
  'amazonia':       [13, 29, 32],
  'caatinga':       [13, 29, 32],
  'cerrado':        [13, 29, 32],
  'mata_atlantica': [13, 29, 32],
  'pampa':          [13, 29, 32],
  'pantanal':       [13, 29, 32, 33]
};

// Set years to be processed 
var years_list = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
                  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
                  2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                  2018, 2019, 2020, 2021, 2022, 2023, 2024
                  ];

// read biomes
var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster');
//Map.addLayer(biomes.randomVisualizer(),{}, 'Biomas');

// build biomes dictionary
var biomes_name = ['amazonia', 'caatinga', 'cerrado', 'mata_atlantica', 'pampa', 'pantanal'];
var biomes_dict = {
  'amazonia':       1,
  'caatinga':       5,
  'cerrado':        4,
  'mata_atlantica': 2,
  'pampa':          6,
  'pantanal':       3
};

var recipe = ee.Image([]);

// for each year
years_list.forEach(function(year_j) {

  // read collection 
  var collection = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection10/mapbiomas_brazil_collection10_integration_v2')
    .select('classification_' + year_j);
    
    var recipe_year = ee.Image(0);

  // for each biome, compute fragmentation by using specific criteria
  biomes_name.forEach(function(biome_k) {
      // get native vegetation map
    var native_mask = collection
      .remap({from: native_classes[biome_k].concat(ignore_classes[biome_k]),
              to: ee.List.repeat(1, ee.List(native_classes[biome_k].concat(ignore_classes[biome_k])).length()),
              defaultValue: 0
      })
      // add infrastructure
      //.blend(dnit_roads.remap([1], [21]))
      .updateMask(biomes.eq(biomes_dict[biome_k]))
      .selfMask();
      
      //Map.addLayer(native_mask.randomVisualizer(), {}, String(year_j) + '-' + String(biome_k))
      
      //blend
      recipe_year = recipe_year.blend(native_mask).selfMask();
    });
   
   recipe_year = recipe_year.rename('classification_' + year_j);
   
   recipe = recipe.addBands(recipe_year);
    
  });

print(recipe)

Map.addLayer(recipe.select('classification_1985').randomVisualizer(), {}, '1985')
Map.addLayer(recipe.select('classification_2024').randomVisualizer(), {}, '2024')

Export.image.toAsset({
	image: recipe,
  description: 'nativeMask_' + 'col10_v' + version,
  assetId: 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/native_mask/' + 'nativeMask_' + 'col10_v' + version,
  region: biomes.geometry(),
  scale: 30,
  maxPixels: 1e13,
  priority: 999
  });
