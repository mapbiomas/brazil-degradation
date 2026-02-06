/**** ENN (Euclidean Nearest Neighbor) per tile — GEE JavaScript ****/
/**** Original logic from rgee script (dhemerson.costa@ipam.org.br) ****/

// ------------------------------------------------------------
// Parameters
// ------------------------------------------------------------
var searchRadius = 20000; // meters

var output = 'projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/enn';
var version_out = 1;

var years = [2024]; // add more years if needed, e.g. [2019, 2020, 2021, 2022, 2023, 2024]

// ------------------------------------------------------------
// Inputs
// ------------------------------------------------------------
// Native vegetation patches (bands like fragment_id_YYYY_b1)
var native = ee.ImageCollection('projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/patch-id')
  .toBands();

// grid to process (just one to debug)
var toProcess = [26181];

// Load grids
var hex = ee.FeatureCollection('users/wallacesilva/vetor/sul_america_hex_grid_050km');

// List of tile IDs (FID)
var gridNamesServer = hex.aggregate_array('FID').distinct().sort();

// ------------------------------------------------------------
// Client-side driver (needed because we must create Export tasks)
// ------------------------------------------------------------
gridNamesServer.evaluate(function(gridNames) {
  years.forEach(function(year) {
    print('Processing year', year);

    // Select native veg for the year
    var bandName = 'fragment_id_' + year + '_b1';
    var native_i = native.select(bandName).selfMask();

  
      // ------------------------------------------------------------
      // Per-tile loop: create export tasks
      // ------------------------------------------------------------
      toProcess.forEach(function(grid_ij) {
        print('Tile FID:', grid_ij);

        var grid_i = hex.filter(ee.Filter.eq('FID', grid_ij));
        var grid_i_buffered = grid_i.geometry().buffer(searchRadius);

        // Vectorize patches inside buffered tile
        var patches_i = native_i.reduceToVectors({
          reducer: ee.Reducer.countEvery(),
          geometry: grid_i_buffered,
          crs: native.projection(),
          eightConnected: true,
          maxPixels: 1e13,
          bestEffort: true
        });

        // Spatial join: nearest other polygon within distance, excluding self
        var distFilter = ee.Filter.withinDistance({
          distance: searchRadius,
          leftField: '.geo',
          rightField: '.geo'
        });

        var notSame = ee.Filter.notEquals({
          leftField: 'label',
          rightField: 'label'
        });

        var f = ee.Filter.and(distFilter, notSame);

        var joined = ee.Join.saveBest({
          matchKey: 'nearest_feat',
          measureKey: 'nearest_dist_m'
        }).apply({
          primary: patches_i,
          secondary: patches_i,
          condition: f
        });

        // Attach distance (meters). Handle null matches safely.
        var distanceFc = ee.FeatureCollection(joined).map(function(feat) {
          var dist = ee.Number(ee.Algorithms.If(
            feat.get('nearest_dist_m'),
            feat.get('nearest_dist_m'),
            -9999
          ));
          return feat.set('distance', dist);
        });

        // Rasterize ENN distance (integer meters)
        var grid_img = ee.Image()
          .paint(distanceFc, 'distance')
          .round()
          .toInt()
          // mask out "no-neighbor" sentinel
          .updateMask(ee.Image().paint(distanceFc, 'distance').neq(-9999))
          .rename('ENN_' + year)
          .set({
            year: year,
            grid_name: String(grid_ij),
            version: version_out
          });
        
        Map.addLayer(grid_img, {palette:['green', 'yellow', 'red'], min:30, max: 500}, 'Distance ENN');

        // Export to Asset
        Export.image.toAsset({
          image: grid_img,
          description: 'ENN_' + grid_ij + '_' + year,
          assetId: output + '/ENN_' + grid_ij + '_' + year,
          region: grid_i.geometry(),
          scale: 30,
          maxPixels: 1e13
        });
      });
    });
  });
