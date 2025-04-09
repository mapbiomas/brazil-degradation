// ecosystem fragmentation - edge effect // gt degradaçao - mapbiomas //
// any issue, bug or report write to dhemerson.costa@ipam.org.br and/or mrosa@arcplan.com.br

// set version
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

// definir conjunto de distancias (em metros) para estimar a área sobre efeito de borda
var edge_rules = [30, 60, 90, 120, 150, 300, 600, 1000];

// Set years to be processed 
var years_list = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
                  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
                  2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                  2018, 2019, 2020, 2021, 2022, 2023];

// * -- end of definitions

// * -- ingest infrastructure data
//var dnit_roads = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/INFRASTRUCTURE/dnit_roads_image');
//Map.addLayer(dnit_roads, {}, 'Estradas');

// * -- end o f infrastructure data

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

// for each edge rule (distance)
edge_rules.forEach(function(distance_i) {
  
  // build recipes
  var edge_degrad = ee.Image([]);
  var edge_anthropogenic = ee.Image([]);

  // for each year
  years_list.forEach(function(year_j) {
    
    // build recipes
    var edge_degrad_year = ee.Image(0);
    var edge_anthropogenic_year = ee.Image(0);
      
    // read collection 
    var collection = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1')
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
      var edge = anthropogenic.distance(ee.Kernel.euclidean(distance_i + 10, 'meters'), false);
      edge = edge.mask(edge.lt(distance_i)).mask(collection).selfMask().updateMask(biomes.eq(biomes_dict[biome_k]));
      
        // remove edges over ignored classes
      ignore_classes[biome_k].forEach(function(class_m) {
        edge = edge.updateMask(collection_i.neq(class_m));
      });
      
      // compute classes that causes edge effect (1px)
      if (distance_i === 30) {
         var edge_out = edge.distance(ee.Kernel.euclidean(35, 'meters'), false);
         edge_out = edge_out.mask(edge_out.lt(distance_i)).mask(anthropogenic).selfMask().updateMask(biomes.eq(biomes_dict[biome_k]));
         
        // blend into recipe
        edge_anthropogenic_year = edge_anthropogenic_year.blend(edge_out).selfMask();
        //Map.addLayer(edge_out.randomVisualizer())
        
        // bind into recipe
        //edge_anthropogenic = edge_anthropogenic.addBands(anthropogenic_estimate);
      }
     
      // blend edge into recipe
      edge_degrad_year = edge_degrad_year.blend(edge).selfMask();
      //edge_degrad = edge_degrad.addBands(edge_estimate);
      
    });

    // Retain classes from edge, build-up data and store into recipe 
    var inner = collection.updateMask(edge_degrad_year)
      .rename('edge_' + distance_i + 'm_' + year_j);
      
    var out = collection.updateMask(edge_anthropogenic_year)
      .rename('pressure_' + distance_i + 'm_' + year_j);
      
    //Map.addLayer(inner.randomVisualizer(), {}, year_j + ' inner ' + distance_i);
    //Map.addLayer(out.randomVisualizer(), {}, year_j + ' out ' + distance_i);
    
    // Build images to export 
    edge_degrad = edge_degrad.addBands(inner);
    edge_anthropogenic = edge_anthropogenic.addBands(out);
    
  });
  
  // Set properties
  edge_degrad = edge_degrad.set({'version': version})
                           .set({'distance': distance_i});
  
  edge_anthropogenic = edge_anthropogenic.set({'version': version})
                           .set({'distance': distance_i});
                           
  // Export 
  print(edge_degrad, edge_anthropogenic);
  
  // Edge area
  Export.image.toAsset({
		image: edge_degrad,
    description: 'edge_' + distance_i + 'm_col9_v' + version,
    assetId: 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/edge_area/' + 'edge_' + distance_i + 'm_col9_v' + version,
    region: biomes.geometry(),
    scale: 30,
    maxPixels: 1e13,
    priority: 999
  });
  
  // Pressure class
  if (distance_i === 30) {
    Export.image.toAsset({
		image: edge_anthropogenic,
    description: 'pressure_' + distance_i + 'm_col9_v' + version,
    assetId: 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/edge_pressure/' + 'pressure_' + distance_i + 'm_col9_v' + version,
    region: biomes.geometry(),
    scale: 30,
    maxPixels: 1e13,
    priority: 999
    });
  }
});
