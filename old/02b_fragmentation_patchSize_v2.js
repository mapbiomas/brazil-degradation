// get patch sizes (runs in native level)
// any issue and/or bug, please report to dhemerson.costa@ipam.org.br and mrosa@arcplan.com.br

// set version
var collectionId = 10
var version = 1;

// -- * definitions
// set classes in which edge area will be applied 
// 3 (forest), 4 (savanna), 5 (mangrove), 6 (flooded forest), 11 (wetland), 12 (grassland)
var native_classes = {
  'amazonia':       [3, 4, 5, 6, 11, 12, 49, 50],
  'caatinga':       [3, 4, 5, 11, 12, 49, 50],
  'cerrado':        [3, 4, 5, 11, 12, 49, 50],
  'mata_atlantica': [3, 4, 5, 11, 12, 49, 50],
  'pampa':          [3, 4, 5, 11, 12, 49, 50],
  'pantanal':       [3, 4, 5, 11, 12, 49, 50, 33]
};

// Set years to be processed 
var years_list = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
                  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
                  2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                  2018, 2019, 2020, 2021, 2022, 2023, 2024];
                  //2024]
                  

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

// for each year
years_list.forEach(function(year_j) {
  
    // build recipes
  var patch_degrad_year = ee.Image(0);

  // read collection 
  var collection = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection10/mapbiomas_brazil_collection10_integration_v2')
    .select('classification_' + year_j);
    //.blend(dnit_roads);

  // for each biome, compute fragmentation by using specific criteria
  biomes_name.forEach(function(biome_k) {
      // get native vegetation map
    var native_mask = collection
      .remap({from: native_classes[biome_k],
              to: native_classes[biome_k],
              defaultValue: 21
      })
      // add infrastructure
      //.blend(dnit_roads.remap([1], [21]))
      .updateMask(biomes.eq(biomes_dict[biome_k]));
    
    // mask collection to retain raw classes
    var collection_i = collection.updateMask(native_mask.neq(21));
    //Map.addLayer(collection_i.randomVisualizer(), {}, year_i + ' ' + distance_i + ' ' + biome_k);
    
    // dissolve all native veg. classes into each one
      var native_l0 = collection_i.remap({
        from: native_classes[biome_k],
        to: ee.List.repeat(1, ee.List(native_classes[biome_k]).length())
      });
      
      // compute patche sizes
      var patches = native_l0.connectedPixelCount(1024, true)
        // convert from pixels to hectares
        .multiply(900).divide(10000)
      
      // remove big patches
      patches = patches.updateMask(patches.lte(90))
    
    // blend edge into recipe
    patch_degrad_year = patch_degrad_year.blend(patches).selfMask();

  });
    
  // Retain classes from edge and store into recipe 
  var patch_degrad_year = patch_degrad_year
    .rename('classification_' + year_j);
    
  patch_degrad_year = patch_degrad_year.set('territory', 'BRAZIL')
                                      .set('collection_id', collectionId)
                                      .set('version', version)
                                      .set('year', year_j)
                                      .set('description', 'PATCH SIZE');

    
  Map.addLayer(patch_degrad_year.round().int16(), {palette:['red', 'yellow', 'green'], min:1, max:90}, String(year_j));
  
  // Export
  Export.image.toAsset({
  	image: patch_degrad_year.round().int16(),
    description: 'PATCH_SIZE' + '-' + year_j + '-' + version,
    assetId: 'projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/patch-size/' +  'PATCH-SIZE' + '-' + year_j + '-' + version,
    region: biomes.geometry(),
    scale: 30,
    maxPixels: 1e13,
    priority: 999
  });

});
