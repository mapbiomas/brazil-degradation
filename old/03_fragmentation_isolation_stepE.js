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

//var forestMap = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_forestMask_conn')
var NaturalMap_class = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/natural_Mask85a23_100m_v2')
//var nonforMap_class = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/nonforestMask85a22_100m_v6_sem_remap')
print('NaturalMap_class',NaturalMap_class)
//print('nonforMap_class',nonforMap_class)

//frag25_   //dist05   //100
//frag50_   //dist10   //500
//frag100   //dist20   //1000

var frag25__dist05k__100  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag25_dist05k_100'+'_v6_85_23')
var frag25__dist05k__500  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag25_dist05k_500'+'_v6_85_23')
var frag25__dist05k_1000 = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag25_dist05k_1000'+'_v6_85_23')
var frag25__dist10k__100  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag25_dist10k_100'+'_v6_85_23')
var frag25__dist10k__500  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag25_dist10k_500'+'_v6_85_23')
var frag25__dist10k_1000 = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag25_dist10k_1000'+'_v6_85_23')
var frag25__dist20k__100  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag25_dist20k_100'+'_v6_85_23')
var frag25__dist20k__500  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag25_dist20k_500'+'_v6_85_23')
var frag25__dist20k_1000 = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag25_dist20k_1000'+'_v6_85_23')
//
var frag50__dist05k__100  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag50_dist05k_100'+'_v6_85_23')
var frag50__dist05k__500  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag50_dist05k_500'+'_v6_85_23')
var frag50__dist05k_1000 = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag50_dist05k_1000'+'_v6_85_23')
var frag50__dist10k__100  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag50_dist10k_100'+'_v6_85_23')
var frag50__dist10k__500  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag50_dist10k_500'+'_v6_85_23')
var frag50__dist10k_1000 = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag50_dist10k_1000'+'_v6_85_23')
var frag50__dist20k__100  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag50_dist20k_100'+'_v6_85_23')
var frag50__dist20k__500  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag50_dist20k_500'+'_v6_85_23')
var frag50__dist20k_1000 = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag50_dist20k_1000'+'_v6_85_23')
//
var frag100_dist05k__500  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag100_dist05k_500'+'_v6_85_23')
var frag100_dist05k_1000 = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag100_dist05k_1000'+'_v6_85_23')
var frag100_dist10k__500  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag100_dist10k_500'+'_v6_85_23')
var frag100_dist10k_1000 = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag100_dist10k_1000'+'_v6_85_23')
var frag100_dist20k__500  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag100_dist20k_500'+'_v6_85_23')
var frag100_dist20k_1000 = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag100_dist20k_1000'+'_v6_85_23')
//var frag100_dist05k_100  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag100_dist05k_100'+'_v6_85_23')
//var frag100_dist10k_100  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag100_dist10k_100'+'_v6_85_23')
//var frag100_dist20k_100  = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/BR_Distance/frag100_dist20k_100'+'_v6_85_23')

var years = ['1985','1986','1987','1988','1989','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999','2000','2001','2002','2003','2004','2005','2006','2007','2008','2009','2010','2011','2012','2013','2014','2015','2016','2017','2018','2019','2020','2021','2022','2023']
//var years = ['2000'];

for (var i_year=0;i_year<years.length; i_year++){
  var year = years[i_year];


  var uso_natural_frag25__dist05k__100 = NaturalMap_class.select('natural_'+year).mask(frag25__dist05k__100.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag25__dist05k__500 = NaturalMap_class.select('natural_'+year).mask(frag25__dist05k__500.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag25__dist05k_1000 = NaturalMap_class.select('natural_'+year).mask(frag25__dist05k_1000.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag25__dist10k__100 = NaturalMap_class.select('natural_'+year).mask(frag25__dist10k__100.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag25__dist10k__500 = NaturalMap_class.select('natural_'+year).mask(frag25__dist10k__500.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag25__dist10k_1000 = NaturalMap_class.select('natural_'+year).mask(frag25__dist10k_1000.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag25__dist20k__100 = NaturalMap_class.select('natural_'+year).mask(frag25__dist20k__100.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag25__dist20k__500 = NaturalMap_class.select('natural_'+year).mask(frag25__dist20k__500.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag25__dist20k_1000 = NaturalMap_class.select('natural_'+year).mask(frag25__dist20k_1000.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag50__dist05k__100 = NaturalMap_class.select('natural_'+year).mask(frag50__dist05k__100.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag50__dist05k__500 = NaturalMap_class.select('natural_'+year).mask(frag50__dist05k__500.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag50__dist05k_1000 = NaturalMap_class.select('natural_'+year).mask(frag50__dist05k_1000.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag50__dist10k__100 = NaturalMap_class.select('natural_'+year).mask(frag50__dist10k__100.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag50__dist10k__500 = NaturalMap_class.select('natural_'+year).mask(frag50__dist10k__500.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag50__dist10k_1000 = NaturalMap_class.select('natural_'+year).mask(frag50__dist10k_1000.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag50__dist20k__100 = NaturalMap_class.select('natural_'+year).mask(frag50__dist20k__100.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag50__dist20k__500 = NaturalMap_class.select('natural_'+year).mask(frag50__dist20k__500.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag50__dist20k_1000 = NaturalMap_class.select('natural_'+year).mask(frag50__dist20k_1000.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag100_dist05k__500 = NaturalMap_class.select('natural_'+year).mask(frag100_dist05k__500.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag100_dist05k_1000 = NaturalMap_class.select('natural_'+year).mask(frag100_dist05k_1000.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag100_dist10k__500 = NaturalMap_class.select('natural_'+year).mask(frag100_dist10k__500.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag100_dist10k_1000 = NaturalMap_class.select('natural_'+year).mask(frag100_dist10k_1000.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag100_dist20k__500 = NaturalMap_class.select('natural_'+year).mask(frag100_dist20k__500.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)
  var uso_natural_frag100_dist20k_1000 = NaturalMap_class.select('natural_'+year).mask(frag100_dist20k_1000.select('frag_'+year).eq(1)).remap([3,4,5,6,49,11,12,32,29,50,12],[3,4,5,6,49,11,12,32,29,50,12]).rename('nat_'+year)

//  var uso_nonfor_frag25__dist05k__100 = nonforMap_class.select('nonforest_'+year).mask(frag25__dist05k__100.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag25__dist05k__500 = nonforMap_class.select('nonforest_'+year).mask(frag25__dist05k__500.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag25__dist05k_1000 = nonforMap_class.select('nonforest_'+year).mask(frag25__dist05k_1000.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag25__dist10k__100 = nonforMap_class.select('nonforest_'+year).mask(frag25__dist10k__100.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag25__dist10k__500 = nonforMap_class.select('nonforest_'+year).mask(frag25__dist10k__500.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag25__dist10k_1000 = nonforMap_class.select('nonforest_'+year).mask(frag25__dist10k_1000.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag25__dist20k__100 = nonforMap_class.select('nonforest_'+year).mask(frag25__dist20k__100.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag25__dist20k__500 = nonforMap_class.select('nonforest_'+year).mask(frag25__dist20k__500.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag25__dist20k_1000 = nonforMap_class.select('nonforest_'+year).mask(frag25__dist20k_1000.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag50__dist05k__100 = nonforMap_class.select('nonforest_'+year).mask(frag50__dist05k__100.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag50__dist05k__500 = nonforMap_class.select('nonforest_'+year).mask(frag50__dist05k__500.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag50__dist05k_1000 = nonforMap_class.select('nonforest_'+year).mask(frag50__dist05k_1000.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag50__dist10k__100 = nonforMap_class.select('nonforest_'+year).mask(frag50__dist10k__100.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag50__dist10k__500 = nonforMap_class.select('nonforest_'+year).mask(frag50__dist10k__500.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag50__dist10k_1000 = nonforMap_class.select('nonforest_'+year).mask(frag50__dist10k_1000.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag50__dist20k__100 = nonforMap_class.select('nonforest_'+year).mask(frag50__dist20k__100.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag50__dist20k__500 = nonforMap_class.select('nonforest_'+year).mask(frag50__dist20k__500.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag50__dist20k_1000 = nonforMap_class.select('nonforest_'+year).mask(frag50__dist20k_1000.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag100_dist05k__500 = nonforMap_class.select('nonforest_'+year).mask(frag100_dist05k__500.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag100_dist05k_1000 = nonforMap_class.select('nonforest_'+year).mask(frag100_dist05k_1000.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag100_dist10k__500 = nonforMap_class.select('nonforest_'+year).mask(frag100_dist10k__500.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag100_dist10k_1000 = nonforMap_class.select('nonforest_'+year).mask(frag100_dist10k_1000.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag100_dist20k__500 = nonforMap_class.select('nonforest_'+year).mask(frag100_dist20k__500.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)
//  var uso_nonfor_frag100_dist20k_1000 = nonforMap_class.select('nonforest_'+year).mask(frag100_dist20k_1000.select('frag_'+year).eq(1)).remap([11,12,32,29,50,12],[11,12,32,29,50,12]).rename('nat_'+year)


  var nat_uso_frag25__dist05k__100_ano = uso_natural_frag25__dist05k__100//.blend(uso_nonfor_frag25__dist05k__100)
  var nat_uso_frag25__dist05k__500_ano = uso_natural_frag25__dist05k__500//.blend(uso_nonfor_frag25__dist05k__500)
  var nat_uso_frag25__dist05k_1000_ano = uso_natural_frag25__dist05k_1000//.blend(uso_nonfor_frag25__dist05k_1000)
  var nat_uso_frag25__dist10k__100_ano = uso_natural_frag25__dist10k__100//.blend(uso_nonfor_frag25__dist10k__100)
  var nat_uso_frag25__dist10k__500_ano = uso_natural_frag25__dist10k__500//.blend(uso_nonfor_frag25__dist10k__500)
  var nat_uso_frag25__dist10k_1000_ano = uso_natural_frag25__dist10k_1000//.blend(uso_nonfor_frag25__dist10k_1000)
  var nat_uso_frag25__dist20k__100_ano = uso_natural_frag25__dist20k__100//.blend(uso_nonfor_frag25__dist20k__100)
  var nat_uso_frag25__dist20k__500_ano = uso_natural_frag25__dist20k__500//.blend(uso_nonfor_frag25__dist20k__500)
  var nat_uso_frag25__dist20k_1000_ano = uso_natural_frag25__dist20k_1000//.blend(uso_nonfor_frag25__dist20k_1000)
  var nat_uso_frag50__dist05k__100_ano = uso_natural_frag50__dist05k__100//.blend(uso_nonfor_frag50__dist05k__100)
  var nat_uso_frag50__dist05k__500_ano = uso_natural_frag50__dist05k__500//.blend(uso_nonfor_frag50__dist05k__500)
  var nat_uso_frag50__dist05k_1000_ano = uso_natural_frag50__dist05k_1000//.blend(uso_nonfor_frag50__dist05k_1000)
  var nat_uso_frag50__dist10k__100_ano = uso_natural_frag50__dist10k__100//.blend(uso_nonfor_frag50__dist10k__100)
  var nat_uso_frag50__dist10k__500_ano = uso_natural_frag50__dist10k__500//.blend(uso_nonfor_frag50__dist10k__500)
  var nat_uso_frag50__dist10k_1000_ano = uso_natural_frag50__dist10k_1000//.blend(uso_nonfor_frag50__dist10k_1000)
  var nat_uso_frag50__dist20k__100_ano = uso_natural_frag50__dist20k__100//.blend(uso_nonfor_frag50__dist20k__100)
  var nat_uso_frag50__dist20k__500_ano = uso_natural_frag50__dist20k__500//.blend(uso_nonfor_frag50__dist20k__500)
  var nat_uso_frag50__dist20k_1000_ano = uso_natural_frag50__dist20k_1000//.blend(uso_nonfor_frag50__dist20k_1000)
  var nat_uso_frag100_dist05k__500_ano = uso_natural_frag100_dist05k__500//.blend(uso_nonfor_frag100_dist05k__500)
  var nat_uso_frag100_dist05k_1000_ano = uso_natural_frag100_dist05k_1000//.blend(uso_nonfor_frag100_dist05k_1000)
  var nat_uso_frag100_dist10k__500_ano = uso_natural_frag100_dist10k__500//.blend(uso_nonfor_frag100_dist10k__500)
  var nat_uso_frag100_dist10k_1000_ano = uso_natural_frag100_dist10k_1000//.blend(uso_nonfor_frag100_dist10k_1000)
  var nat_uso_frag100_dist20k__500_ano = uso_natural_frag100_dist20k__500//.blend(uso_nonfor_frag100_dist20k__500)
  var nat_uso_frag100_dist20k_1000_ano = uso_natural_frag100_dist20k_1000//.blend(uso_nonfor_frag100_dist20k_1000)

//  Map.addLayer(frag100_dist20k_1000.select('frag_'+year),{'palette': 'pink'},'frag100_dist20k_1000', false)

//  Map.addLayer(frag25__dist05k__100.select('frag_'+year),{'palette': 'blue'},'frag25__dist05k__500_'+year, false)
//  Map.addLayer(uso_forest_frag25__dist05k__100.select('nat_'+year),{'palette': 'red'},'uso_forest_frag25__dist05k__100_'+year, false)
//  Map.addLayer(uso_nonfor_frag25__dist05k__100.select('nat_'+year),{'palette': 'orange'},'uso_nonfor_frag25__dist05k__100_'+year, false)
//  Map.addLayer(nat_uso_forest_frag25__dist05k__100.select('nat_'+year),{'palette': 'green'},'nat_uso_forest_frag25__dist05k__100'+year, false)
  if (i_year == 0){ 
    var nat_uso_frag25__dist05k__100 = nat_uso_frag25__dist05k__100_ano
    var nat_uso_frag25__dist05k__500 = nat_uso_frag25__dist05k__500_ano
    var nat_uso_frag25__dist05k_1000 = nat_uso_frag25__dist05k_1000_ano
    var nat_uso_frag25__dist10k__100 = nat_uso_frag25__dist10k__100_ano
    var nat_uso_frag25__dist10k__500 = nat_uso_frag25__dist10k__500_ano
    var nat_uso_frag25__dist10k_1000 = nat_uso_frag25__dist10k_1000_ano
    var nat_uso_frag25__dist20k__100 = nat_uso_frag25__dist20k__100_ano
    var nat_uso_frag25__dist20k__500 = nat_uso_frag25__dist20k__500_ano
    var nat_uso_frag25__dist20k_1000 = nat_uso_frag25__dist20k_1000_ano
    var nat_uso_frag50__dist05k__100 = nat_uso_frag50__dist05k__100_ano
    var nat_uso_frag50__dist05k__500 = nat_uso_frag50__dist05k__500_ano
    var nat_uso_frag50__dist05k_1000 = nat_uso_frag50__dist05k_1000_ano
    var nat_uso_frag50__dist10k__100 = nat_uso_frag50__dist10k__100_ano
    var nat_uso_frag50__dist10k__500 = nat_uso_frag50__dist10k__500_ano
    var nat_uso_frag50__dist10k_1000 = nat_uso_frag50__dist10k_1000_ano
    var nat_uso_frag50__dist20k__100 = nat_uso_frag50__dist20k__100_ano
    var nat_uso_frag50__dist20k__500 = nat_uso_frag50__dist20k__500_ano
    var nat_uso_frag50__dist20k_1000 = nat_uso_frag50__dist20k_1000_ano
    var nat_uso_frag100_dist05k__500 = nat_uso_frag100_dist05k__500_ano
    var nat_uso_frag100_dist05k_1000 = nat_uso_frag100_dist05k_1000_ano
    var nat_uso_frag100_dist10k__500 = nat_uso_frag100_dist10k__500_ano
    var nat_uso_frag100_dist10k_1000 = nat_uso_frag100_dist10k_1000_ano
    var nat_uso_frag100_dist20k__500 = nat_uso_frag100_dist20k__500_ano
    var nat_uso_frag100_dist20k_1000 = nat_uso_frag100_dist20k_1000_ano
  }  
  else {
    nat_uso_frag25__dist05k__100 = nat_uso_frag25__dist05k__100.addBands(nat_uso_frag25__dist05k__100_ano)
    nat_uso_frag25__dist05k__500 = nat_uso_frag25__dist05k__500.addBands(nat_uso_frag25__dist05k__500_ano)
    nat_uso_frag25__dist05k_1000 = nat_uso_frag25__dist05k_1000.addBands(nat_uso_frag25__dist05k_1000_ano)
    nat_uso_frag25__dist10k__100 = nat_uso_frag25__dist10k__100.addBands(nat_uso_frag25__dist10k__100_ano)
    nat_uso_frag25__dist10k__500 = nat_uso_frag25__dist10k__500.addBands(nat_uso_frag25__dist10k__500_ano)
    nat_uso_frag25__dist10k_1000 = nat_uso_frag25__dist10k_1000.addBands(nat_uso_frag25__dist10k_1000_ano)
    nat_uso_frag25__dist20k__100 = nat_uso_frag25__dist20k__100.addBands(nat_uso_frag25__dist20k__100_ano)
    nat_uso_frag25__dist20k__500 = nat_uso_frag25__dist20k__500.addBands(nat_uso_frag25__dist20k__500_ano)
    nat_uso_frag25__dist20k_1000 = nat_uso_frag25__dist20k_1000.addBands(nat_uso_frag25__dist20k_1000_ano)
    nat_uso_frag50__dist05k__100 = nat_uso_frag50__dist05k__100.addBands(nat_uso_frag50__dist05k__100_ano)
    nat_uso_frag50__dist05k__500 = nat_uso_frag50__dist05k__500.addBands(nat_uso_frag50__dist05k__500_ano)
    nat_uso_frag50__dist05k_1000 = nat_uso_frag50__dist05k_1000.addBands(nat_uso_frag50__dist05k_1000_ano)
    nat_uso_frag50__dist10k__100 = nat_uso_frag50__dist10k__100.addBands(nat_uso_frag50__dist10k__100_ano)
    nat_uso_frag50__dist10k__500 = nat_uso_frag50__dist10k__500.addBands(nat_uso_frag50__dist10k__500_ano)
    nat_uso_frag50__dist10k_1000 = nat_uso_frag50__dist10k_1000.addBands(nat_uso_frag50__dist10k_1000_ano)
    nat_uso_frag50__dist20k__100 = nat_uso_frag50__dist20k__100.addBands(nat_uso_frag50__dist20k__100_ano)
    nat_uso_frag50__dist20k__500 = nat_uso_frag50__dist20k__500.addBands(nat_uso_frag50__dist20k__500_ano)
    nat_uso_frag50__dist20k_1000 = nat_uso_frag50__dist20k_1000.addBands(nat_uso_frag50__dist20k_1000_ano)
    nat_uso_frag100_dist05k__500 = nat_uso_frag100_dist05k__500.addBands(nat_uso_frag100_dist05k__500_ano)
    nat_uso_frag100_dist05k_1000 = nat_uso_frag100_dist05k_1000.addBands(nat_uso_frag100_dist05k_1000_ano)
    nat_uso_frag100_dist10k__500 = nat_uso_frag100_dist10k__500.addBands(nat_uso_frag100_dist10k__500_ano)
    nat_uso_frag100_dist10k_1000 = nat_uso_frag100_dist10k_1000.addBands(nat_uso_frag100_dist10k_1000_ano)
    nat_uso_frag100_dist20k__500 = nat_uso_frag100_dist20k__500.addBands(nat_uso_frag100_dist20k__500_ano)
    nat_uso_frag100_dist20k_1000 = nat_uso_frag100_dist20k_1000.addBands(nat_uso_frag100_dist20k_1000_ano)
  }


}

//  Map.addLayer(ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/nat_uso_forest_frag25__dist05k__100').select('nat_'+year),{'palette': 'yellow'},'exportado'+year, false)


var dirout = 'projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9_v2/'

Export.image.toAsset({ "image": nat_uso_frag25__dist05k__100.toInt16(),  "description": 'nat_uso_frag25__dist05k__100'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag25__dist05k__100'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag25__dist05k__500.toInt16(),  "description": 'nat_uso_frag25__dist05k__500'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag25__dist05k__500'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag25__dist05k_1000.toInt16(),  "description": 'nat_uso_frag25__dist05k_1000'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag25__dist05k_1000'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag25__dist10k__100.toInt16(),  "description": 'nat_uso_frag25__dist10k__100'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag25__dist10k__100'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag25__dist10k__500.toInt16(),  "description": 'nat_uso_frag25__dist10k__500'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag25__dist10k__500'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag25__dist10k_1000.toInt16(),  "description": 'nat_uso_frag25__dist10k_1000'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag25__dist10k_1000'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag25__dist20k__100.toInt16(),  "description": 'nat_uso_frag25__dist20k__100'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag25__dist20k__100'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag25__dist20k__500.toInt16(),  "description": 'nat_uso_frag25__dist20k__500'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag25__dist20k__500'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag25__dist20k_1000.toInt16(),  "description": 'nat_uso_frag25__dist20k_1000'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag25__dist20k_1000'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  

Export.image.toAsset({ "image": nat_uso_frag50__dist05k__100.toInt16(),  "description": 'nat_uso_frag50__dist05k__100'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag50__dist05k__100'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag50__dist05k__500.toInt16(),  "description": 'nat_uso_frag50__dist05k__500'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag50__dist05k__500'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag50__dist05k_1000.toInt16(),  "description": 'nat_uso_frag50__dist05k_1000'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag50__dist05k_1000'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag50__dist10k__100.toInt16(),  "description": 'nat_uso_frag50__dist10k__100'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag50__dist10k__100'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag50__dist10k__500.toInt16(),  "description": 'nat_uso_frag50__dist10k__500'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag50__dist10k__500'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag50__dist10k_1000.toInt16(),  "description": 'nat_uso_frag50__dist10k_1000'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag50__dist10k_1000'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag50__dist20k__100.toInt16(),  "description": 'nat_uso_frag50__dist20k__100'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag50__dist20k__100'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag50__dist20k__500.toInt16(),  "description": 'nat_uso_frag50__dist20k__500'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag50__dist20k__500'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag50__dist20k_1000.toInt16(),  "description": 'nat_uso_frag50__dist20k_1000'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag50__dist20k_1000'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  

Export.image.toAsset({ "image": nat_uso_frag100_dist05k__500.toInt16(),  "description": 'nat_uso_frag100_dist05k__500'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag100_dist05k__500'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag100_dist05k_1000.toInt16(),  "description": 'nat_uso_frag100_dist05k_1000'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag100_dist05k_1000'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag100_dist10k__500.toInt16(),  "description": 'nat_uso_frag100_dist10k__500'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag100_dist10k__500'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag100_dist10k_1000.toInt16(),  "description": 'nat_uso_frag100_dist10k_1000'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag100_dist10k_1000'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag100_dist20k__500.toInt16(),  "description": 'nat_uso_frag100_dist20k__500'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag100_dist20k__500'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
Export.image.toAsset({ "image": nat_uso_frag100_dist20k_1000.toInt16(),  "description": 'nat_uso_frag100_dist20k_1000'+'_v7_85_23',
                     "assetId": dirout + 'nat_uso_frag100_dist20k_1000'+'_v7_85_23',  "scale": 100, "pyramidingPolicy": {'.default': 'mode'},"maxPixels": 1e13, "region": geometry });  
