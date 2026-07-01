var amzBiome = ee.FeatureCollection("projects/imazon-simex/SAD/DATABASE/VECTOR/AMZ_AmazonBiome"),
    amzLegal = ee.FeatureCollection("projects/imazon-simex/SAD/DATABASE/VECTOR/AMZ_legal"),
    imageVisParam = {"opacity":1,"bands":["ndfi"],"min":-1.751350998878479,"max":1.1634492874145508,"palette":["000000","2a0000","550000","800000","aa0000","d40000","ccf8ff","ffffff","ffffff","ffffff","c7ffff","00ffff"]},
    geometry = 
    /* color: #98ff00 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-74.38018164849359, 5.91265023906032],
          [-74.38018164849359, -18.61225084146742],
          [-42.39760718560297, -18.61225084146742],
          [-42.39760718560297, 5.91265023906032]]], null, false);

var roi = amzBiome.merge(amzLegal);

// --- CONFIGURAÇÃO DE MODO ---
// true  = Compara o mês atual com os mesmos meses dos anos anteriores (Ex: Jan vs Jan/Jan/Jan)
// false = Compara o mês atual com a mediana de todos os 36 meses anteriores
var MODO_SAZONAL = false; 

// --- FUNÇÕES DE PROCESSAMENTO ---

function getCollection(dateStart, dateEnd, roi){
    var col = ee.ImageCollection('LANDSAT/COMPOSITES/C02/T1_L2_32DAY')
        .filterDate(dateStart, dateEnd)
        .filterBounds(roi)
        .map(function(img){return img.clip(roi)});
    return col;
}
function getFractions(image) {
      var ENDMEMBERS = [
          [0.0119,0.0475,0.0169,0.625,0.2399,0.0675], // GV
          [0.1514,0.1597,0.1421,0.3053,0.7707,0.1975], // NPV
          [0.1799,0.2479,0.3158,0.5437,0.7707,0.6646], // Soil
          [0.4031,0.8714,0.79,0.8989,0.7002,0.6607] // Cloud
      ];
      var outBandNames = ['gv', 'npv', 'soil', 'cloud'];
      var fractions = ee.Image(image).select(['blue', 'green', 'red', 'nir', 'swir1', 'swir2'])
          .unmix(ENDMEMBERS).max(0).rename(outBandNames);
      var shade = fractions.expression('b("gv") + b("npv") + b("soil")').subtract(1.0).abs().rename("shade");
      return image.addBands(fractions).addBands(shade);
}
function getNdfi(image){
      var summed = image.expression('b("gv") + b("npv") + b("soil")');
      var gvs = image.select("gv").divide(summed).rename("gvs");
      var npvSoil = image.expression('b("npv") + b("soil")');
      var ndfi = ee.Image.cat(gvs, npvSoil).normalizedDifference().rename('ndfi');
      return image.addBands(gvs).addBands(ndfi.clamp(-1, 1));
}

// --- CONFIGURAÇÕES VISUAIS ---
var thermalPalette = ['#ffffff', '#f7d3fd', '#f0a7f9', '#e87af5', '#e14df1', '#d1368c', '#f5a25e', '#f7e241', '#eeb02e', '#9d9d24', '#4a8d1a', '#0d5e0d'];
var palettes = require('users/gena/packages:palettes');
var assetLulc = "projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1";

var defaultParams = {
    'tresh_dam_min': -0.250, // Limite inferior (queda forte)
    'tresh_dam_max': -0.095, // Limite superior (queda leve)
    'time_window': 3         // Anos de histórico
};

var listParams = [
  [1988, defaultParams],
  [1989, defaultParams],
  [1990, defaultParams],
  [1991, defaultParams],
  [1992, defaultParams],
  [1993, defaultParams],
  [1994, defaultParams],
  [1995, defaultParams],
  [1996, defaultParams],
  [1997, defaultParams],
  [1998, defaultParams],
  [1999, defaultParams],
  [2000, defaultParams],
  [2001, defaultParams],
  [2002, defaultParams],
  [2003, defaultParams],
  [2004, defaultParams],
  [2005, defaultParams],
  [2006, defaultParams],
  [2007, defaultParams],
  [2008, defaultParams],
  [2009, defaultParams],
  [2010, defaultParams],
  [2011, defaultParams],
  [2012, defaultParams],
  [2013, defaultParams],
  [2014, defaultParams],
  [2015, defaultParams],
  [2016, defaultParams],
  [2017, defaultParams],
  [2018, defaultParams],
  [2019, defaultParams],
  [2020, defaultParams],
  [2021, defaultParams],
  [2022, defaultParams],
  [2023, defaultParams],
  [2024, defaultParams]
];

// --- LOOP PRINCIPAL ---

listParams.forEach(function(params){
    var year = params[0];
    var dictParams = params[1];
    var lulc = ee.Image(assetLulc).select('classification_' + (year - 1));

    var start = year + '-01-01';
    var end = year + '-12-31';
    var startTm = (year - dictParams['time_window']) + '-01-01';
    var endTm = year + '-01-01';
    
    var collectionTarget = getCollection(start, end, roi).map(getFractions).map(getNdfi).select(['ndfi']);
    var collectionTimeWin = getCollection(startTm, endTm, roi).map(getFractions).map(getNdfi).select(['ndfi']);

    // --- LÓGICA DE REFERÊNCIA (SAZONAL OU GLOBAL) ---
    var referenceSource;
    
    if (MODO_SAZONAL) {
      // Cria 12 imagens (uma para cada mês)
      var months = ee.List.sequence(1, 12);
      referenceSource = ee.ImageCollection.fromImages(months.map(function(m) {
        return collectionTimeWin.filter(ee.Filter.calendarRange(m, m, 'month'))
          .median().set('month', m).rename('ndfi_ref');
      }));
      print("Modo Ativo: Sazonal (Mês a Mês)");
    } else {
      // Cria uma única imagem (mediana de todos os 36 meses)
      var globalMedian = collectionTimeWin.median().rename('ndfi_ref');
      referenceSource = globalMedian;
      print("Modo Ativo: Global (Últimos 36 meses juntos)");
    }

    // --- PROCESSAMENTO DE DESVIOS ---
    var collectionDeviations = collectionTarget.map(function(img) {
        var month = img.date().get('month');
        
        // Seleciona a referência correta baseada no modo
        var refImg = MODO_SAZONAL 
            ? referenceSource.filter(ee.Filter.eq('month', month)).first()
            : referenceSource;
        
        var diff = img.subtract(refImg).rename('change');
        
        var deviation = diff
            .updateMask(refImg.gt(0.80)) // Máscara de floresta estável na referência
            .updateMask(lulc.eq(3).or(lulc.eq(6))) // Máscara MapBiomas
            .rename('deviation');
            
        // Lógica de aprovação com filtros gt e lt (mais estável para negativos)
        var approved = deviation.gt(dictParams['tresh_dam_min'])
                        .and(deviation.lt(dictParams['tresh_dam_max']))
                        .rename('approved').selfMask();

        return img.addBands([refImg, diff, deviation, approved])
                  .copyProperties(img, ['system:time_start', 'system:time_end']);
    });

    // Soma das detecções mensais (Frequência)
    var sumDam = collectionDeviations.select('approved').sum().rename('freq_dam').selfMask().byte();

    // Mostra como exemplo
    var mesAlvo = 7; 
    var sample = collectionDeviations.filter(ee.Filter.calendarRange(mesAlvo, mesAlvo, 'month')).first();
    
    /*
    Map.addLayer(sample.select('ndfi').clip(roi), {min: 0.5, max: 1, palette: thermalPalette}, '1. NDFI Atual ' + mesAlvo);
    Map.addLayer(sample.select('ndfi_ref').clip(roi), {min: 0.5, max: 1, palette: thermalPalette}, '2. Referência ' + mesAlvo);
    Map.addLayer(sample.select('change').clip(roi), {min: -0.2, max: 0.2, palette: ['red', 'white', 'blue']}, '3. Diferença ' + mesAlvo);
    Map.addLayer(sample.select('approved').clip(roi), {palette: ['#FF4500']}, '4. Pixels na Regra ' + mesAlvo);
    
    Map.addLayer(sumDam.clip(roi), {
      min: 1, max: 12,
      palette: palettes.cmocean.Thermal[7]
    }, '5. FREQUENCIA ANUAL (' + year + ')');
    */
    
    // --- EXPORTAR ---
    var suffix = MODO_SAZONAL ? '_sazonal' : '_global';
    Export.image.toAsset({
      image: sumDam.set("year", year).set("modo", suffix).set("step", "1"),
      description: 'freq_degradacao_' + year + suffix,
      assetId: "projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/LOGGIN/" + year + suffix,
      region: geometry,
      pyramidingPolicy:{'.default': 'MODE'},
      scale: 30,
      maxPixels: 1e13
    });
});