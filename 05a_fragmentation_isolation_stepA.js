// Define uma variável para versão de saída
var v_out = '2';

// Importa o módulo de Paletas do MapBiomas e define uma paleta de visualização
var Palettes = require('users/mapbiomas/modules:Palettes.js');
var palette = Palettes.get('classification8');
var vis = {'min': 0,'max': 62,'palette': palette,'format': 'png'};

// Carrega o raster dos biomas e aplica uma máscara para selecionar o Bioma 2 (ex: Cerrado)
var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41');
var pantanal = biomes.mask(biomes.eq(3));
Map.addLayer(pantanal, {}, 'pantanal', false); // Adiciona a camada de biomas ao mapa

var lulc = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1')
Map.addLayer(lulc.select('classification_2024'), vis, 'lulc', false); // Adiciona a camada de biomas ao mapa
var lulc_pant = lulc.mask(pantanal)
Map.addLayer(lulc_pant.select('classification_2024'), vis, 'lulc_pant', false); // Adiciona a camada de biomas ao mapa

// Carrega e processa a máscara de floresta e calcula a distância para áreas não florestadas

// Define os anos a serem analisados
var anos = [1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,
            1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,
            2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,
            2021,2022,2023, 2024];

// Loop para cada ano definido
for (var i_ano = 0; i_ano < anos.length; i_ano++) {
    var ano = anos[i_ano];
    // Cria uma máscara de floresta para o ano atual
//    var forestMask_ano = lulc.select('classification_' + ano)
//        .remap([], [], 0).rename('forest_' + ano);
    // Cria uma máscara de áreas não florestadas para o ano atual
    var naturalMask_ano = lulc.select('classification_' + ano)
        .remap([3,4,5,6,49,11,12,13,23,29,32,50], [3,4,5,6,49,11,12,13,23,29,32,50], 0).rename('natural_' + ano);
    var nonforestPant_ano = lulc_pant.select('classification_' + ano)
        .remap([3,4,5,6,49,11,12,13,23,29,32,50,33], [3,4,5,6,49,11,12,13,23,29,32,50,33], 0).rename('natural_' + ano);
    // Inicializa as máscaras no primeiro ano ou adiciona as bandas de máscara para anos subsequentes
    if (i_ano == 0) { 
//        var forestMask85a23_100m = forestMask_ano;
        var naturalMask85a24_100m = naturalMask_ano.blend(nonforestPant_ano);
    } else {
//        forestMask85a23_100m = forestMask85a23_100m.addBands(forestMask_ano);
        naturalMask85a24_100m = naturalMask85a24_100m.addBands(naturalMask_ano.blend(nonforestPant_ano));
    }
}

Map.addLayer(naturalMask85a24_100m.select('natural_2024'), vis, 'naturalMask85a24_100m', false); // Adiciona a camada de biomas ao mapa


// Exibe as máscaras combinadas no console
//print('forestMask85a23_100m', forestMask85a23_100m);
print('naturalMask85a24_100m', naturalMask85a24_100m);

// Define o diretório de saída para exportação dos dados
var dirout = 'projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/';

// Exporta a máscara de floresta para o asset do usuário
//Export.image.toAsset({
//    "image": forestMask85a23_100m.toInt16(),
//    "description": 'forestMask85a23_100m_v' + v_out,
//    "assetId": dirout + 'forestMask85a23_100m_v' + v_out,
//    "scale": 100,
//    "pyramidingPolicy": {'.default': 'mode'},
//    "maxPixels": 1e13,
//    "region": geometry
//});

// Exporta a máscara de não floresta para o asset do usuário
Export.image.toAsset({
    "image": naturalMask85a24_100m.toInt16(),
    "description": 'natural_Mask85a24_100m_v' + v_out,
    "assetId": dirout + 'natural_Mask85a24_100m_v' + v_out,
    "scale": 100,
    "pyramidingPolicy": {'.default': 'mode'},
    "maxPixels": 1e13,
    "region": geometry
});
