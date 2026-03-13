// ecosystem fragmentation - edge effect // gt degradaçao - mapbiomas //
// any issue, bug or report write to dhemerson.costa@ipam.org.br and/or mrosa@arcplan.com.br

// set version
var collectionId = 10;
var version = 2;

// set filename
var fileName = 'degradation_edge_area_col' + collectionId + '_v' + version;

// -- * definitions
// set classes in which edge area will be applied 
// 3 (forest), 4 (savanna), 5 (mangrove), 6 (flooded forest), 11 (wetland), 12 (grassland)
var native_classes = {
  'amazonia':       [3, 4, 5, 6, 11, 12, 49, 50],
  'caatinga':       [3, 4, 5, 11, 12, 49, 50],
  'cerrado':        [3, 4, 5, 11, 12, 49, 50],
  'mata_atlantica': [3, 4, 5, 11, 12, 49, 50],
  'pampa':          [3, 4, 5, 11, 12, 49, 50],
  'pantanal':       [3, 4, 5, 11, 12, 49, 50]
};

// dset classes to be ignored (which doesn't produces edge area)
// 13 (other non forest), 29 (rocky outcrop), 32 (hypersaline tidal flat), 33 (water)
var ignore_classes = {
  'amazonia':       [13, 29, 32, 33],
  'caatinga':       [13, 29, 32, 33],
  'cerrado':        [13, 29, 32, 33],
  'mata_atlantica': [13, 29, 32, 33],
  'pampa':          [13, 29, 32, 33],
  'pantanal':       [13, 29, 32, 33]
};

// Set years to be processed 
var years_list = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
                  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
                  2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                  2018, 2019, 2020, 2021, 2022, 2023, 2024];

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

// build recipe
var recipe = ee.Image([]);

// for each year
years_list.forEach(function(year_j) {
  
  // build recipes
  var edge_degrad_year = ee.Image(0);

  // read collection 
  var collection = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1')
    .select('classification_' + year_j);
    //.blend(dnit_roads);

  // for each biome, compute fragmentation by using specific criteria
  biomes_name.forEach(function(biome_k) {
      // get native vegetation map
    var native_mask = collection
      .remap({from: native_classes[biome_k].concat(ignore_classes[biome_k]),
              to: native_classes[biome_k].concat(ignore_classes[biome_k]),
              defaultValue: 21
      })
      // add infrastructure
      //.blend(dnit_roads.remap([1], [21]))
      .updateMask(biomes.eq(biomes_dict[biome_k]));
    
    // mask collection to retain raw classes
    var collection_i = collection.updateMask(native_mask.neq(21));
    //Map.addLayer(collection_i.randomVisualizer(), {}, year_i + ' ' + distance_i + ' ' + biome_k);
    
    // -- * get edge effect
    // retain anthropogenic classes to be used as reference for the edge 
    var anthropogenic = native_mask.updateMask(native_mask.eq(21));
    
    // compute edge 
    var edge = anthropogenic.distance(ee.Kernel.euclidean(7500, 'meters'), false);

    // remove edges over ignored classes
    ignore_classes[biome_k].forEach(function(class_m) {
      edge = edge.updateMask(collection_i.neq(class_m));
    });
    
    // limit to 7km
    edge_degrad_year = edge_degrad_year.updateMask(edge_degrad_year.lte(7000));
    
    // blend edge into recipe
    edge_degrad_year = edge_degrad_year.blend(edge).selfMask();
    //edge_degrad = edge_degrad.addBands(edge_estimate);
    
  });
    
  // Retain classes from edge and store into recipe 
  var edge_degrad_year = edge_degrad_year
    .rename('edge_' + year_j);
    
  edge_degrad_year = edge_degrad_year.set('territory', 'BRAZIL')
                                      .set('collection_id', collectionId)
                                      .set('version', version)
                                      .set('year', year_j)
                                      .set('description', 'EDGE AREA');

    
  Map.addLayer(edge_degrad_year.round().int16(), {palette:['red', 'yellow', 'green'], min:1, max:7000}, String(year_j));
  
  // bind
  recipe = recipe.addBands(edge_degrad_year);
  
});

// Standardize image
recipe = recipe.round().int16();
print('Output Image:', recipe);

// Export edge area
Export.image.toAsset({
	image: recipe.round().int16(),
  description: fileName,
  assetId: 'projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/public/' + fileName,
  region: biomes.geometry(),
  scale: 30,
  maxPixels: 1e13,
  priority: 999
});
