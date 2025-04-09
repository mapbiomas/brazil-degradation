// get fire recurrence with native coverage (runs in native level)
// by: IPAM, wallace.silva@ipam.org.br
// any issue and/or bug, please report to dhemerson.costa@ipam.org.br and mrosa@arcplan.com.br


// --- --- --- DATASETS
// read coverage by mapbiomas collection 9
var coverage = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1');
// --- --- FIRE recurrence
// read recurrence fire by mapbiomas fogo collection 3.1
var recurrence = ee.Image('projects/mapbiomas-public/assets/brazil/fire/collection3_1/mapbiomas_fire_collection31_fire_recurrence_v1');

// get geometry for export params
var region = coverage.geometry();


// --- --- --- PROCESS
// formated image for recurrence information
var fire_recurrence = recurrence
  .int16()
  .slice(0,39);
  // .aside(print);

// --- --- NATIVE COVERAGE
// set classes to be computed native coverage
// 3 (forest), 4 (savanna), 5 (mangrove), 6 (flooded forest), 11 (wetland), 12 (grassland)
var native_classes = [3, 4, 5, 6, 11, 12, 49, 50];

// set native coverage image
var native_coverage = ee.Image(
  ee.List(native_classes).iterate(function(current,previous){
      var i = ee.Number(current);

      var before = ee.Image(previous)
        .where(coverage.eq(i),i);

      return before;
    }, 
    coverage.multiply(0)
  )
).selfMask();

// --- --- CROSSING
var fire_recurrence_native_coverege = fire_recurrence
  .multiply(100)
  .unmask(0)
  .add(native_coverage);

var oldBands = fire_recurrence_native_coverege.bandNames();
var newBands = oldBands.iterate(function(current,previous){
  return ee.List(previous)
    .add(ee.String('recurrence_').cat(ee.String(current).slice(-4)));
},[]);

fire_recurrence_native_coverege = fire_recurrence_native_coverege
  .select(oldBands,newBands);

print('fire_recurrence_native_coverege',fire_recurrence_native_coverege);

// --- --- --- PLOT
var visParams = {
  coverage:{
    min:0,
    max:62,
    palette:[],
    bands:['classification_2022']
  },
  recurrence:{
    min:0,
    max:3800,
    palette:[],
    bands:['recurrence_2022']
  },
  recurrence_2:{
    min:0,
    max:38,
    palette:[],
    bands:['fire_recurrence_1985_2022']
  }
};

Map.addLayer(region,{},'region',false);
Map.addLayer(coverage,visParams.coverage,'coverage');
Map.addLayer(native_coverage,visParams.coverage,'native_coverage');

Map.addLayer(fire_recurrence_native_coverege,visParams.recurrence,'fire_recurrence_native_coverege');
Map.addLayer(fire_recurrence,visParams.recurrence_2,'fire_recurrence');

// --- --- --- EXPORT

// Set properties in metadata image
var properties = {
  'version': 1,
  'product':'recurrence'
};
// set export image
var recipe = fire_recurrence_native_coverege.set(properties);
var description = 'recurrence_col9_v'+ properties.version;
var assetId = 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/fire/' + description;

print(ui.Label('Exporting image:'),recipe,ui.Label(' for address:'+assetId));

// export
 Export.image.toAsset({
	image: recipe,
  description:'fire-'+ description,
  assetId: assetId,
  region: region,
  pyramidingPolicy:'mode',
  scale: 30,
  maxPixels: 1e13,
});
