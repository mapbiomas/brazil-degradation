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
var brazil_25k = biomes.remap([10],[25001],25001);
Map.addLayer(brazil_0, {}, 'brazil_0', false)
var bioma250mil = biomes.mask(biomes.eq(2));
Map.addLayer(bioma250mil, {}, 'Bioma Raster', false)

//var forestMap = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION/BR_forestMask_conn')
//var forestMap = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION/forestMask85a22_100m_v5_conn')
var nonforMap = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/natural_Mask85a24_100m_v2_conn')
//print(forestMap)
print(nonforMap)

var natural_mask_maior1000ha = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/BR_Distance/natural_mask_maior1000ha_85_242')
var natural_mask_maior500ha = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/BR_Distance/natural_mask_maior500ha_85_242')
var natural_mask_maior100ha = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/BR_Distance/natural_mask_maior1000ha_85_242')

var distanceTonatural_maior1000ha = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/BR_Distance/distanceToforestMask_maior1000ha_85_242')
var distanceTonatural_maior500ha = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/BR_Distance/distanceToforestMask_maior500ha_85_242')
var distanceTonatural_maior100ha = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/BR_Distance/distanceToforestMask_maior100ha_85_242')

print(distanceTonatural_maior1000ha)

var years = ['1985','1986','1987','1988','1989','1990','1991','1992','1993','1994',
             '1995','1996','1997','1998','1999','2000','2001','2002','2003','2004',
             '2005','2006','2007','2008','2009','2010','2011','2012','2013','2014',
             '2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'];
//var years = ['2022'];

for (var i_year=0;i_year<years.length; i_year++){
  var year = years[i_year];

  //var forestMask_5a90ha = forestMask.blend(con_5a90ha_remap)
  var natural_mask_maior1000ha_ano = natural_mask_maior1000ha.select('frag'+year)
  var natural_mask_maior500ha_ano = natural_mask_maior500ha.select('frag'+year)
  var natural_mask_maior100ha_ano = natural_mask_maior100ha.select('frag'+year)
  
  //brazil_0.blend(forest_maior100ha_ano)
//  Map.addLayer(natural_mask_maior1000ha_ano.selfMask(), {}, 'natural_mask_maior1000ha_ano'+year, false)
//  Map.addLayer(natural_mask_maior500ha_ano.selfMask(), {}, 'natural_mask_maior500ha_ano'+year, false)
//  Map.addLayer(natural_mask_maior100ha_ano.selfMask(), {}, 'natural_mask_maior100ha_ano'+year, false)

  // Create a distance function
  var distanceTonatural_maior1000ha_ano = distanceTonatural_maior1000ha.select('dist'+year)
  var distanceTonatural_maior500ha_ano = distanceTonatural_maior500ha.select('dist'+year)
  var distanceTonatural_maior100ha_ano = distanceTonatural_maior100ha.select('dist'+year)

  distanceTonatural_maior1000ha_ano = brazil_25k.blend(distanceTonatural_maior1000ha_ano)
  distanceTonatural_maior500ha_ano = brazil_25k.blend(distanceTonatural_maior500ha_ano)
  distanceTonatural_maior100ha_ano = brazil_25k.blend(distanceTonatural_maior100ha_ano)
  //Map.addLayer(distanceTonatural_maior1000ha_ano, {  min: 0,  max: 25000,palette: ['yellow','red','#3d1817']}, 'distanceTonatural_maior1000ha_ano', true)
  //Map.addLayer(distanceTonatural_maior500ha_ano, {  min: 0,  max: 25000,palette: ['yellow','red','#3d1817']}, 'distanceTonatural_maior500ha_ano', true)
  //Map.addLayer(distanceTonatural_maior100ha_ano, {  min: 0,  max: 25000,palette: ['yellow','red','#3d1817']}, 'distanceTonatural_maior100ha_ano', true)

//  var forest_25ha_ano = forestMap.select('conect_'+year).lte(25).remap([1],[1])
  var nonfor_25ha_ano = nonforMap.select('conect_'+year).lte(25).remap([1],[1])
  var frag25 = brazil_0.blend(nonfor_25ha_ano).selfMask()
//Map.addLayer(frag25,{},'frag25')
//  var forest_50ha_ano = forestMap.select('conect_'+year).lte(50).remap([1],[1])
  var nonfor_50ha_ano = nonforMap.select('conect_'+year).lte(50).remap([1],[1])
  var frag50 = brazil_0.blend(nonfor_50ha_ano).selfMask()

//  var forest_100ha_ano = forestMap.select('conect_'+year).lte(100).remap([1],[1])
  var nonfor_100ha_ano = nonforMap.select('conect_'+year).lte(100).remap([1],[1])
  var frag100 = brazil_0.blend(nonfor_100ha_ano).selfMask()


  var frag25_comp = frag25.connectedComponents({connectedness: ee.Kernel.plus(1),maxSize: 550  });
  var frag50_comp = frag50.connectedComponents({connectedness: ee.Kernel.plus(1),maxSize: 550  });
  var frag100_comp = frag100.connectedComponents({connectedness: ee.Kernel.plus(1),maxSize: 550  });


  var dist_frag25_1000 = distanceTonatural_maior1000ha_ano.rename('distance').mask(frag25_comp.select('remapped').eq(1)).addBands(frag25_comp.select('labels'))
  var dist_frag25_500 = distanceTonatural_maior500ha_ano.rename('distance').mask(frag25_comp.select('remapped').eq(1)).addBands(frag25_comp.select('labels'))
  var dist_frag25_100 = distanceTonatural_maior100ha_ano.rename('distance').mask(frag25_comp.select('remapped').eq(1)).addBands(frag25_comp.select('labels'))
  var frag25_dist_1000_ano = dist_frag25_1000.reduceConnectedComponents(ee.Reducer.min(), 'labels', 256).rename('min_dist_1000_'+year)
  var frag25_dist_500__ano = dist_frag25_500.reduceConnectedComponents(ee.Reducer.min(), 'labels', 256).rename('min_dist_500_'+year)
  var frag25_dist_100__ano = dist_frag25_100.reduceConnectedComponents(ee.Reducer.min(), 'labels', 256).rename('min_dist_100_'+year)

  var dist_frag50_1000 = distanceTonatural_maior1000ha_ano.rename('distance').mask(frag50_comp.select('remapped').eq(1)).addBands(frag50_comp.select('labels'))
  var dist_frag50_500 = distanceTonatural_maior500ha_ano.rename('distance').mask(frag50_comp.select('remapped').eq(1)).addBands(frag50_comp.select('labels'))
  var dist_frag50_100 = distanceTonatural_maior100ha_ano.rename('distance').mask(frag50_comp.select('remapped').eq(1)).addBands(frag50_comp.select('labels'))
  var frag50_dist_1000_ano = dist_frag50_1000.reduceConnectedComponents(ee.Reducer.min(), 'labels', 256).rename('min_dist_1000_'+year)
  var frag50_dist_500__ano = dist_frag50_500.reduceConnectedComponents(ee.Reducer.min(), 'labels', 256).rename('min_dist_500_'+year)
  var frag50_dist_100__ano = dist_frag50_100.reduceConnectedComponents(ee.Reducer.min(), 'labels', 256).rename('min_dist_100_'+year)

  var dist_frag100_1000 = distanceTonatural_maior1000ha_ano.rename('distance').mask(frag100_comp.select('remapped').eq(1)).addBands(frag100_comp.select('labels'))
  var dist_frag100_500 = distanceTonatural_maior500ha_ano.rename('distance').mask(frag100_comp.select('remapped').eq(1)).addBands(frag100_comp.select('labels'))
//  var dist_frag100_100 = distanceTonatural_maior100ha_ano.rename('distance').mask(frag100_comp.select('remapped').eq(1)).addBands(frag100_comp.select('labels'))
  var frag100_dist_1000_ano = dist_frag100_1000.reduceConnectedComponents(ee.Reducer.min(), 'labels', 256).rename('min_dist_1000_'+year)
  var frag100_dist_500__ano = dist_frag100_500.reduceConnectedComponents(ee.Reducer.min(), 'labels', 256).rename('min_dist_500_'+year)
//  var frag100_dist_100_ano = dist_frag100_100.reduceConnectedComponents(ee.Reducer.min(), 'labels', 256).rename('min_dist_100_'+year)

//print('frag25_dist_1000_ano',frag25_dist_1000_ano)
var frag25_dist05_1000_ano = frag25_dist_1000_ano.gt(5000).remap([1],[1]).rename('frag_'+year)
var frag25_dist10_1000_ano = frag25_dist_1000_ano.gt(10000).remap([1],[1]).rename('frag_'+year)
var frag25_dist20_1000_ano = frag25_dist_1000_ano.gt(20000).remap([1],[1]).rename('frag_'+year)
var frag25_dist05_500__ano = frag25_dist_500__ano.gt(5000).remap([1],[1]).rename('frag_'+year)
var frag25_dist10_500__ano = frag25_dist_500__ano.gt(10000).remap([1],[1]).rename('frag_'+year)
var frag25_dist20_500__ano = frag25_dist_500__ano.gt(20000).remap([1],[1]).rename('frag_'+year)
var frag25_dist05_100__ano = frag25_dist_100__ano.gt(5000).remap([1],[1]).rename('frag_'+year)
var frag25_dist10_100__ano = frag25_dist_100__ano.gt(10000).remap([1],[1]).rename('frag_'+year)
var frag25_dist20_100__ano = frag25_dist_100__ano.gt(20000).remap([1],[1]).rename('frag_'+year)

//Map.addLayer(frag25_dist05_1000_ano,{},'frag25_dist05_1000_ano')
//Map.addLayer(frag25_dist10_1000_ano,{},'frag25_dist10_1000_ano')
//Map.addLayer(frag25_dist15_1000_ano,{},'frag25_dist15_1000_ano')

var frag50_dist05_1000_ano = frag50_dist_1000_ano.gt(5000).remap([1],[1]).rename('frag_'+year)
var frag50_dist10_1000_ano = frag50_dist_1000_ano.gt(10000).remap([1],[1]).rename('frag_'+year)
var frag50_dist20_1000_ano = frag50_dist_1000_ano.gt(20000).remap([1],[1]).rename('frag_'+year)
var frag50_dist05_500__ano = frag50_dist_500__ano.gt(5000).remap([1],[1]).rename('frag_'+year)
var frag50_dist10_500__ano = frag50_dist_500__ano.gt(10000).remap([1],[1]).rename('frag_'+year)
var frag50_dist20_500__ano = frag50_dist_500__ano.gt(20000).remap([1],[1]).rename('frag_'+year)
var frag50_dist05_100__ano = frag50_dist_100__ano.gt(5000).remap([1],[1]).rename('frag_'+year)
var frag50_dist10_100__ano = frag50_dist_100__ano.gt(10000).remap([1],[1]).rename('frag_'+year)
var frag50_dist20_100__ano = frag50_dist_100__ano.gt(20000).remap([1],[1]).rename('frag_'+year)

var frag100_dist05_1000_ano = frag100_dist_1000_ano.gt(5000).remap([1],[1]).rename('frag_'+year)
var frag100_dist10_1000_ano = frag100_dist_1000_ano.gt(10000).remap([1],[1]).rename('frag_'+year)
var frag100_dist20_1000_ano = frag100_dist_1000_ano.gt(20000).remap([1],[1]).rename('frag_'+year)
var frag100_dist05_500__ano = frag100_dist_500__ano.gt(5000).remap([1],[1]).rename('frag_'+year)
var frag100_dist10_500__ano = frag100_dist_500__ano.gt(10000).remap([1],[1]).rename('frag_'+year)
var frag100_dist20_500__ano = frag100_dist_500__ano.gt(20000).remap([1],[1]).rename('frag_'+year)
//var frag100_dist05_100__ano = frag100_dist_100__ano.gt(5000).remap([1],[1])
//var frag100_dist10_100__ano = frag100_dist_100__ano.gt(10000).remap([1],[1])
//var frag100_dist20_100__ano = frag100_dist_100__ano.gt(20000).remap([1],[1])

  if (i_year == 0){ 
    var frag25_dist05k_1000 = frag25_dist05_1000_ano
    var frag25_dist10k_1000 = frag25_dist10_1000_ano
    var frag25_dist20k_1000 = frag25_dist20_1000_ano
    var frag25_dist05k_500 =  frag25_dist05_500__ano
    var frag25_dist10k_500 =  frag25_dist10_500__ano
    var frag25_dist20k_500 =  frag25_dist20_500__ano
    var frag25_dist05k_100 =  frag25_dist05_100__ano
    var frag25_dist10k_100 =  frag25_dist10_100__ano
    var frag25_dist20k_100 =  frag25_dist20_100__ano

    var frag50_dist05k_1000 = frag50_dist05_1000_ano
    var frag50_dist10k_1000 = frag50_dist10_1000_ano
    var frag50_dist20k_1000 = frag50_dist20_1000_ano
    var frag50_dist05k_500 =  frag50_dist05_500__ano
    var frag50_dist10k_500 =  frag50_dist10_500__ano
    var frag50_dist20k_500 =  frag50_dist20_500__ano
    var frag50_dist05k_100 =  frag50_dist05_100__ano
    var frag50_dist10k_100 =  frag50_dist10_100__ano
    var frag50_dist20k_100 =  frag50_dist20_100__ano

    var frag100_dist05k_1000 = frag100_dist05_1000_ano
    var frag100_dist10k_1000 = frag100_dist10_1000_ano
    var frag100_dist20k_1000 = frag100_dist20_1000_ano
    var frag100_dist05k_500 =  frag100_dist05_500__ano
    var frag100_dist10k_500 =  frag100_dist10_500__ano
    var frag100_dist20k_500 =  frag100_dist20_500__ano
//    var frag100_dist05k_100 =  frag100_dist05_100__ano
//    var frag100_dist10k_100 =  frag100_dist10_100__ano
//    var frag100_dist20k_100 =  frag100_dist20_100__ano


  }  
  else {

    var frag25_dist05k_1000 = frag25_dist05k_1000.addBands(frag25_dist05_1000_ano)
    var frag25_dist10k_1000 = frag25_dist10k_1000.addBands(frag25_dist10_1000_ano)
    var frag25_dist20k_1000 = frag25_dist20k_1000.addBands(frag25_dist20_1000_ano)
    var frag25_dist05k_500 =  frag25_dist05k_500.addBands(frag25_dist05_500__ano)
    var frag25_dist10k_500 =  frag25_dist10k_500.addBands(frag25_dist10_500__ano)
    var frag25_dist20k_500 =  frag25_dist20k_500.addBands(frag25_dist20_500__ano)
    var frag25_dist05k_100 =  frag25_dist05k_100.addBands(frag25_dist05_100__ano)
    var frag25_dist10k_100 =  frag25_dist10k_100.addBands(frag25_dist10_100__ano)
    var frag25_dist20k_100 =  frag25_dist20k_100.addBands(frag25_dist20_100__ano)

    var frag50_dist05k_1000 = frag50_dist05k_1000.addBands(frag50_dist05_1000_ano)
    var frag50_dist10k_1000 = frag50_dist10k_1000.addBands(frag50_dist10_1000_ano)
    var frag50_dist20k_1000 = frag50_dist20k_1000.addBands(frag50_dist20_1000_ano)
    var frag50_dist05k_500 =  frag50_dist05k_500.addBands(frag50_dist05_500__ano)
    var frag50_dist10k_500 =  frag50_dist10k_500.addBands(frag50_dist10_500__ano)
    var frag50_dist20k_500 =  frag50_dist20k_500.addBands(frag50_dist20_500__ano)
    var frag50_dist05k_100 =  frag50_dist05k_100.addBands(frag50_dist05_100__ano)
    var frag50_dist10k_100 =  frag50_dist10k_100.addBands(frag50_dist10_100__ano)
    var frag50_dist20k_100 =  frag50_dist20k_100.addBands(frag50_dist20_100__ano)

    var frag100_dist05k_1000 = frag100_dist05k_1000.addBands(frag100_dist05_1000_ano)
    var frag100_dist10k_1000 = frag100_dist10k_1000.addBands(frag100_dist10_1000_ano)
    var frag100_dist20k_1000 = frag100_dist20k_1000.addBands(frag100_dist20_1000_ano)
    var frag100_dist05k_500 =  frag100_dist05k_500.addBands(frag100_dist05_500__ano)
    var frag100_dist10k_500 =  frag100_dist10k_500.addBands(frag100_dist10_500__ano)
    var frag100_dist20k_500 =  frag100_dist20k_500.addBands(frag100_dist20_500__ano)
//    var frag100_dist05k_100 = frag100_dist05k_100.addBands(frag100_dist05_100__ano)
//    var frag100_dist10k_100 = frag100_dist10k_100.addBands(frag100_dist10_100__ano)
//    var frag100_dist20k_100 = frag100_dist20k_100.addBands(frag100_dist20_100__ano)
  }
}

natural_mask_maior1000ha
natural_mask_maior500ha
natural_mask_maior100ha


var newBands = natural_mask_maior100ha.bandNames().map(function(band) {
  return ee.String('isolation_').cat(ee.String(band).slice(-4))
})

var distances100ha = natural_mask_maior100ha.unmask(0).multiply(0)
  .where(natural_mask_maior100ha, 10) // Área fonte com 100 a 500 ha
  .where(frag50_dist05k_100, 2) // Fragmentos de até 50 ha distantes 5 km de áreas fonte
  .where(frag25_dist05k_100, 3) // Fragmentos de até 25 ha distantes 5 km de áreas fonte
  .where(frag50_dist10k_100, 5) // Fragmentos de até 50 ha distantes 10 km de áreas fonte
  .where(frag25_dist10k_100, 6) // Fragmentos de até 25 ha distantes 10 km de áreas fonte
  .where(frag50_dist20k_100, 8) // Fragmentos de até 50 ha distantes 20 km de áreas fonte
  .where(frag25_dist20k_100, 9) // Fragmentos de até 25 ha distantes 20 km de áreas fonte
  .rename(newBands)
  .selfMask()
  
  Map.addLayer(distances100ha.select(0).randomVisualizer())

var distances500ha = natural_mask_maior500ha.unmask(0).multiply(0)
  .where(natural_mask_maior500ha, 10) // Área fonte com 500 a 1000 ha
  .where(frag100_dist05k_500, 1) // Fragmentos de até 100 ha distantes 5 km de áreas fonte
  .where(frag50_dist05k_500, 2) // Fragmentos de até 50 ha distantes 5 km de áreas fonte
  .where(frag25_dist05k_500, 3) // Fragmentos de até 25 ha distantes 5 km de áreas fonte
  .where(frag100_dist10k_500, 4) // Fragmentos de até 100 ha distantes 10 km de áreas fonte
  .where(frag50_dist10k_500, 5) // Fragmentos de até 50 ha distantes 10 km de áreas fonte
  .where(frag25_dist10k_500, 6) // Fragmentos de até 25 ha distantes 10 km de áreas fonte
  .where(frag50_dist20k_500, 8) // Fragmentos de até 50 ha distantes 20 km de áreas fonte
  .where(frag25_dist20k_500, 9) // Fragmentos de até 25 ha distantes 20 km de áreas fonte
  .rename(newBands)
  .selfMask()

var distances1000ha = natural_mask_maior1000ha.unmask(0).multiply(0)
  .where(natural_mask_maior1000ha, 10) // Área fonte com 1000 ha ou mais
  .where(frag100_dist05k_1000, 1) // Fragmentos de até 100 ha distantes 5 km de áreas fonte
  .where(frag50_dist05k_1000, 2) // Fragmentos de até 50 ha distantes 5 km de áreas fonte
  .where(frag25_dist05k_1000, 3) // Fragmentos de até 25 ha distantes 5 km de áreas fonte
  .where(frag100_dist10k_1000, 4) // Fragmentos de até 100 ha distantes 10 km de áreas fonte
  .where(frag50_dist10k_1000, 5) // Fragmentos de até 50 ha distantes 10 km de áreas fonte
  .where(frag25_dist10k_1000, 6) // Fragmentos de até 25 ha distantes 10 km de áreas fonte
  .where(frag100_dist20k_1000, 7) // Fragmentos de até 100 ha distantes 20 km de áreas fonte
  .where(frag50_dist20k_1000, 8) // Fragmentos de até 50 ha distantes 20 km de áreas fonte
  .where(frag25_dist20k_1000, 9) // Fragmentos de até 25 ha distantes 20 km de áreas fonte
  .rename(newBands)
  .selfMask()




var dirout = 'projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/isolation-v2/'
var v_out = '2'

Export.image.toAsset({
   "image": distances100ha.toInt16(),
   "description": 'isolation_100ha_col101'+'_v' + v_out,
   "assetId": dirout + 'isolation_100ha_col10'+'_v' + v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  
  
Export.image.toAsset({
   "image": distances500ha.toInt16(),
   "description": 'isolation_500ha_col101'+'_v' + v_out,
   "assetId": dirout + 'isolation_500ha_col10'+'_v' + v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  
  
Export.image.toAsset({
   "image": distances1000ha.toInt16(),
   "description": 'isolation_1000ha_col101'+'_v' + v_out,
   "assetId": dirout + 'isolation_1000ha_col10'+'_v' + v_out,
   "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry
  });  
