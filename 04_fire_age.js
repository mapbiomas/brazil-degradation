// get fire age with native coverage (runs in native level)
// by: IPAM, wallace.silva@ipam.org.br
// any issue and/or bug, please report to dhemerson.costa@ipam.org.br and mrosa@arcplan.com.br


// --- --- --- DATASETS
// read coverage by mapbiomas collection 9
var coverage = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1');
// --- --- FIRE AGE
// read age fire by mapbiomas fogo collection 3.1
var age = ee.Image('projects/mapbiomas-public/assets/brazil/fire/collection3_1/mapbiomas_fire_collection31_time_after_fire_v1');

// get geometry for export params
var region = coverage.geometry();

// --- --- --- PROCESS
// formated image for age information
var fire_age = age
  // .slice(0,-1);
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
).selfMask()
.slice(1);

// --- --- CROSSING
var fire_age_native_coverege = fire_age
  .multiply(100)
  // .unmask(0)
  .add(native_coverage);

var oldBands = fire_age_native_coverege.bandNames();
var newBands = oldBands.iterate(function(current,previous){
  return ee.List(previous)
    .add(ee.String('age_').cat(ee.String(current).slice(-4)));
},[]);

fire_age_native_coverege = fire_age_native_coverege
  .select(oldBands,newBands);

print('fire_age_native_coverege',fire_age_native_coverege);

// --- --- --- PLOT
var visParams = {
  coverage:{
    min:0,
    max:62,
    palette:[],
    bands:['classification_2022']
  },
  age:{
    min:0,
    max:3800,
    palette:[],
    bands:['age_2022']
  },
  age_2:{
    min:0,
    max:38,
    palette:[],
    bands:['classification_2022']
  }
};

Map.addLayer(region,{},'region',false);
Map.addLayer(coverage,visParams.coverage,'coverage');
Map.addLayer(native_coverage,visParams.coverage,'native_coverage');

Map.addLayer(fire_age_native_coverege,visParams.age,'fire_age_native_coverege');
Map.addLayer(fire_age,visParams.age_2,'fire_age');

// --- --- --- EXPORT

// Set properties in metadata image
var properties = {
  'version':1,
  'product':'age'
};
// set export image
var recipe = fire_age_native_coverege.set(properties);
var description = 'age_col9_v'+properties.version;
var assetId = 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/fire/' + description;

print(ui.Label('Exporting image:'),recipe,ui.Label(' for address:'+assetId));

// export
 Export.image.toAsset({
	image: recipe,
  description:'fire-'+description,
  assetId: assetId,
  region: region,
  pyramidingPolicy:'mode',
  scale: 30,
  maxPixels: 1e13,
});
