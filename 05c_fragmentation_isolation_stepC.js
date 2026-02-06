var v_out = '1'

var Palettes = require('users/mapbiomas/modules:Palettes.js');
var palette = Palettes.get('classification8');
var vis = {
          'min': 0,
          'max': 62,
          'palette': palette,
          'format': 'png'
      };

//var ano = 2020

var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41')
var brazil_0 = biomes.remap([10],[0],0);
Map.addLayer(brazil_0, {}, 'brazil_0', false)
var bioma250mil = biomes.mask(biomes.eq(2));
Map.addLayer(bioma250mil, {}, 'Bioma Raster', false)

//var forestMap = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION/BR_forestMask_conn')
//var forestMap = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION/nonforestMask85a23_100m_v2_conn')
var nonforestMap = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col10_v1/natural_Mask85a24_100m_v1_conn')
//print(forestMap)
print(nonforestMap)

var years = ['1985','1986','1987','1988','1989','1990','1991','1992','1993','1994',
             '1995','1996','1997','1998','1999','2000','2001','2002','2003','2004',
             '2005','2006','2007','2008','2009','2010','2011','2012','2013','2014',
             '2015','2016','2017','2018','2019','2020','2021','2022','2023', '2024'];
//var years = ['2022'];

for (var i_year=0;i_year<years.length; i_year++){
  var year = years[i_year];

//  var forestMap_ano = forestMap.select('conect_'+year)
  var nonforestMap_ano = nonforestMap.select('conect_'+year)
//  Map.addLayer(forestMap_ano.selfMask(), {}, 'forestMap_ano'+year, false)

//  var forest_maior1000ha_ano = forestMap_ano.select('conect_'+year).gt(1000)
//  var forest_maior500ha_ano = forestMap_ano.select('conect_'+year).gt(500)
//  var forest_maior100ha_ano = forestMap_ano.select('conect_'+year).gt(100)
  
//  Map.addLayer(forest_maior1000ha.selfMask(), {}, 'forest_maior1000ha'+year, false)

  var natural_mask_maior1000ha_ano = nonforestMap_ano.select('conect_'+year).gte(1000)
  var natural_mask_maior500ha_ano = nonforestMap_ano.select('conect_'+year).gte(500)
  var natural_mask_maior100ha_ano = nonforestMap_ano.select('conect_'+year).gte(100)

  var con_menor_1000ha_ano = nonforestMap_ano.select('conect_'+year).lte(1000).remap([1],[0])

  //var forestMask_5a90ha = forestMask.blend(con_5a90ha_remap)
//  var natural_mask_maior1000ha_ano = brazil_0.blend(forest_maior1000ha_ano).blend(nonforest_maior1000ha_ano)//.selfMask()
//  var natural_mask_maior500ha_ano = brazil_0.blend(forest_maior500ha_ano).blend(nonforest_maior500ha_ano)//.selfMask()
//  var natural_mask_maior100ha_ano = brazil_0.blend(forest_maior100ha_ano).blend(nonforest_maior100ha_ano)//.selfMask()
//  Map.addLayer(natural_mask_maior1000ha_ano.selfMask(), {}, 'natural_mask_maior1000ha_ano'+year, false)
//  Map.addLayer(natural_mask_maior500ha_ano.selfMask(), {}, 'natural_mask_maior500ha_ano'+year, false)
//  Map.addLayer(natural_mask_maior100ha_ano.selfMask(), {}, 'natural_mask_maior100ha_ano'+year, false)

  // Create a distance function
  var distanceTonatural_maior1000ha_ano = natural_mask_maior1000ha_ano.distance(ee.Kernel.euclidean(25000, 'meters'));
  var distanceTonatural_maior500ha_ano = natural_mask_maior500ha_ano.distance(ee.Kernel.euclidean(25000, 'meters'));
  var distanceTonatural_maior100ha_ano = natural_mask_maior100ha_ano.distance(ee.Kernel.euclidean(25000, 'meters'));
//  Map.addLayer(distanceTonatural_maior1000ha_ano, {  min: 0,  max: 25000,palette: ['yellow','red','#3d1817']}, 'distanceTonatural_maior1000ha_ano', true)
//  Map.addLayer(distanceTonatural_maior500ha_ano, {  min: 0,  max: 25000,palette: ['yellow','red','#3d1817']}, 'distanceTonatural_maior500ha_ano', true)
//  Map.addLayer(distanceTonatural_maior100ha_ano, {  min: 0,  max: 25000,palette: ['yellow','red','#3d1817']}, 'distanceTonatural_maior100ha_ano', true)

  var dirout = 'projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col10_v1/BR_Distance/'
  
  // Get a list of forest fragments using connectedComponents().
  var naturalFragments_menor1000ha_ano = con_menor_1000ha_ano.connectedComponents({connectedness: ee.Kernel.plus(1),maxSize: 1001});
//  print(forestFragments_menor1000ha_ano)

  if (i_year == 0){ 
    var distanceTonatural_maior1000ha = distanceTonatural_maior1000ha_ano.rename('dist'+year)
    var distanceTonatural_maior500ha = distanceTonatural_maior500ha_ano.rename('dist'+year)
    var distanceTonatural_maior100ha = distanceTonatural_maior100ha_ano.rename('dist'+year)
    var naturalFragments_menor1000ha = naturalFragments_menor1000ha_ano.select('labels').rename('labels'+year)
    var natural_mask_maior1000ha = natural_mask_maior1000ha_ano.rename('frag'+year)
    var natural_mask_maior500ha = natural_mask_maior500ha_ano.rename('frag'+year)
    var natural_mask_maior100ha = natural_mask_maior100ha_ano.rename('frag'+year)

  }  
  else {
    distanceTonatural_maior1000ha = distanceTonatural_maior1000ha.addBands(distanceTonatural_maior1000ha_ano.rename('dist'+year));
    distanceTonatural_maior500ha = distanceTonatural_maior500ha.addBands(distanceTonatural_maior500ha_ano.rename('dist'+year));
    distanceTonatural_maior100ha = distanceTonatural_maior100ha.addBands(distanceTonatural_maior100ha_ano.rename('dist'+year));
    naturalFragments_menor1000ha = naturalFragments_menor1000ha_ano.addBands(naturalFragments_menor1000ha_ano.select('labels').rename('frag'+year));
    natural_mask_maior1000ha = natural_mask_maior1000ha.addBands(natural_mask_maior1000ha_ano.rename('frag'+year));
    natural_mask_maior500ha = natural_mask_maior500ha.addBands(natural_mask_maior500ha_ano.rename('frag'+year));
    natural_mask_maior100ha = natural_mask_maior100ha.addBands(natural_mask_maior100ha_ano.rename('frag'+year));

  }
}

//var dist = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION/BR_Distance/distanceToforestMask_maior1000ha_v5_2022')
//  Map.addLayer(dist, {  min: 0,  max: 25000,palette: ['yellow','red','#3d1817']}, 'dist', true)

print(distanceTonatural_maior1000ha)

  Export.image.toAsset({
   "image": distanceTonatural_maior1000ha.toInt16(),
   "description": 'distanceToforestMask_maior1000ha_85_24'+v_out,
   "assetId": dirout + 'distanceToforestMask_maior1000ha_85_24'+v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  
  Export.image.toAsset({
   "image": distanceTonatural_maior500ha.toInt16(),
   "description": 'distanceToforestMask_maior500ha_85_24'+v_out,
   "assetId": dirout + 'distanceToforestMask_maior500ha_85_24'+v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  
  Export.image.toAsset({
   "image": distanceTonatural_maior100ha.toInt16(),
   "description": 'distanceToforestMask_maior100ha_85_24'+v_out,
   "assetId": dirout + 'distanceToforestMask_maior100ha_85_24'+v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  

  Export.image.toAsset({
   "image": naturalFragments_menor1000ha,
   "description": 'naturalFragments_menor1000ha_85_24'+v_out,
   "assetId": dirout + 'naturalFragments_menor1000ha_85_24'+v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  
  
    Export.image.toAsset({
   "image": natural_mask_maior1000ha.toInt16(),
   "description": 'natural_mask_maior1000ha_85_24'+v_out,
   "assetId": dirout + 'natural_mask_maior1000ha_85_24'+v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  
  Export.image.toAsset({
   "image": natural_mask_maior500ha.toInt16(),
   "description": 'natural_mask_maior500ha_85_24'+v_out,
   "assetId": dirout + 'natural_mask_maior500ha_85_24'+v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  
  Export.image.toAsset({
   "image": natural_mask_maior100ha.toInt16(),
   "description": 'natural_mask_maior100ha_85_24'+v_out,
   "assetId": dirout + 'natural_mask_maior100ha_85_24'+v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  
