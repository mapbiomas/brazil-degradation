// get patch sizes (runs in native level)
// any issue and/or bug, please report to dhemerson.costa@ipam.org.br and mrosa@arcplan.com.br

// set version
var version = 1;

// -- * definitions
// set classes to be computed  
// 3 (forest), 4 (savanna), 5 (mangrove), 6 (flooded forest), 11 (wetland), 12 (grassland)
var native_classes = {
  'amazonia':       [3, 4, 5, 6, 11, 12, 49, 50],
  'caatinga':       [3, 4, 5, 11, 12, 49, 50],
  'cerrado':        [3, 4, 5, 11, 12, 49, 50],
  'mata_atlantica': [3, 4, 5, 11, 12, 49, 50],
  'pampa':          [3, 4, 5, 11, 12, 49, 50],
  'pantanal':       [3, 4, 5, 11, 12, 49, 50, 33]
};

// set patch size rules (in hectares)
var patch_sizes = [3, 5, 10, 25, 50, 75];

// Set years to be processed 
var years_list = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
                  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
                  2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                  2018, 2019, 2020, 2021, 2022, 2023];

// read biomes
var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster');

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

// for each patche size 
patch_sizes.forEach(function(size_i) {
  
  // convert hectares to number of pixels
  var size_criteria = parseInt((size_i * 10000) / 900);
  
  // build recipe for the size
  var recipe_size = ee.Image([]);
  
  // for each year
  years_list.forEach(function(year_j) {
    
    // build recipe for the year 
    var recipe_year = ee.Image(0);
    
    // read collection 
    var collection = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1')
      .select('classification_' + year_j);
      
    // for each biome
    biomes_name.forEach(function(biome_k) {
      // get native vegetation map
      var native_mask = collection
        .remap({from: native_classes[biome_k],
                to: native_classes[biome_k],
                defaultValue: 21
        }).updateMask(biomes.eq(biomes_dict[biome_k]));
      
      // mask collection to retain raw classes
      var collection_i = collection.updateMask(native_mask.neq(21));
      
      // dissolve all native veg. classes into each one
      var native_l0 = collection_i.remap({
        from: native_classes[biome_k],
        to: ee.List.repeat(1, ee.List(native_classes[biome_k]).length())
      });
    
      // compute patche sizes
      var patches = native_l0.connectedPixelCount(size_criteria + 5, true);
      
      // get only patches smaller than the criteria
      var size_degradation = patches.lte(size_criteria).selfMask();
      
      // retain classes from original classification 
      var size_class = collection.select('classification_' + year_j)
        .updateMask(size_degradation)
        // discard water (pantanal case)
        .updateMask(collection.select('classification_' + year_j).neq(33));
      
      // insert into recipe
      recipe_year = recipe_year.blend(size_class).selfMask();
      
      });
    
    // store into recipe
    recipe_size = recipe_size.addBands(recipe_year.rename('size_' + size_i + 'ha_' + year_j));

  });
  
  //Map.addLayer(recipe_size.select('size_' + size_i + 'ha_1985').randomVisualizer(), {}, size_i + ' 1985');
  //Map.addLayer(recipe_size.select('size_' + size_i + 'ha_2000').randomVisualizer(), {}, size_i + ' 2000');
  Map.addLayer(recipe_size.select('size_' + size_i + 'ha_2022').randomVisualizer(), {}, size_i + ' 2022');


  // Set properties
  recipe_size = recipe_size.set({'version': version})
                           .set({'size': size_i});

  // Export 
  print(recipe_size);

  // Export
   Export.image.toAsset({
		image: recipe_size,
    description: 'size_' + size_i + 'ha_col9_v' + version,
    assetId: 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/patch_size/' + 'size_' + size_i + 'ha_col9_v' + version,
    region: biomes.geometry(),
    scale: 30,
    maxPixels: 1e13,
  });
  
});
