// 1. Configurações e Ativos Fixos (Fora da função para performance)
var estado = ee.Image("projects/mapbiomas-workspace/AUXILIAR/estados-2016-raster").remap([13,12,11,14,16],[1,1,1,1,1]);
var amzLegal = ee.Image("projects/imazon-simex/SAD/DATABASE/RASTER/AMZ_legal").gt(0).selfMask();
var amzBiome = ee.Image("projects/imazon-simex/SAD/DATABASE/RASTER/AMZ_bioma");
var srtm = ee.Image("USGS/SRTMGL1_003");
var pedologia = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection10/mapbiomas_brazil_collection10_pedology_ibge_v2').remap([9,10],[1,1]);
var pedregosidade = ee.Image("projects/mapbiomas-public/assets/brazil/soil/collection3/mapbiomas_brazil_collection3_soil_stoniness_v1/soil_depth_stoniness_90_v1")

Map.addLayer(pedregosidade)

// Máscaras de geometria (assumindo que 'geometry' e 'geometry2' estão nos seus imports)
var mask = ee.Image(1).clip(geometry);

// Função principal de processamento
var getDamByYear = function(year) {
  
  // A. Carregar Coleção DAM
  var damCol = ee.ImageCollection("projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/LOGGIN")
                .filter(ee.Filter.eq("step", "1"))
                .filter(ee.Filter.eq("modo", "_global"))
                .filter(ee.Filter.eq("year", year));
  
  var damYear = damCol.first();
  
  // B. Carregar Densidadeg (Ajuste: o Asset de densidade precisa existir para o ano)
  // Se o asset for fixo para 2020, mantenha como estava. 
  // Se houver um para cada ano, use: '.../dam_' + year + '_grid'
  var density = ee.FeatureCollection('projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/DENSIDADE/dam_' + year + '_grid');
  
  var imgDensity = density.reduceToImage({
    properties: ['dam_norm'],
    reducer: ee.Reducer.first(),
  });

  // C. Lógica de Filtros e Máscaras
  var processedDam = damYear
    .where(damYear.lte(1), 0)
    //.where(imgDensity.lt(0.007), 0)
    .where(srtm.gt(300).and(estado), 0)
    .where(pedologia.and(damYear.lte(2)), 0)
    //.where(mask, 0)
    .selfMask()
    //.uint8(); // Otimiza para exportação

  return processedDam.set('year', year);
};

// --- CONTROLE DE ANOS ---
// Para exportar todos: ee.List.sequence(1988, 2024).getInfo()
var yearsToExport = [2020]; 

yearsToExport.forEach(function(y) {
  var finalImage = getDamByYear(y);
  
  // Adiciona ao mapa para conferência
  Map.addLayer(finalImage, imageVisParam, 'DAM ' + y);
  
  Export.image.toAsset({
    image: finalImage,
    description: 'dam_' + y,
    assetId: 'projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/' + 'dam_' + y,
    pyramidingPolicy: {'.default': 'mode'},
    region: region,
    scale:30,
    maxPixels:1e13
  });

});

// Visualização do Mosaico (Apenas para o ano atual de referência no mapa)
var mosaic = ee.ImageCollection('projects/nexgenmap/MapBiomas2/LANDSAT/BRAZIL/mosaics-2')
  .filter(ee.Filter.eq('biome', 'AMAZONIA'))
  .filter(ee.Filter.eq('year', 2020))
  .select(['swir1_median','nir_median','red_median'])
  .mosaic();

Map.addLayer(mosaic, {gain: [0.08,0.06,0.2], gamma: 0.75}, 'Mosaico 2020');
