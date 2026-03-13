var v_out = '2'

// Importa o módulo de paletas de cores do MapBiomas e define uma paleta de visualização
var Palettes = require('users/mapbiomas/modules:Palettes.js');
var palette = Palettes.get('classification8');
var vis = {
    'min': 0,
    'max': 62,
    'palette': palette,
    'format': 'png'
};

// Carrega o raster dos biomas e aplica uma máscara para selecionar o Bioma 2 (ex: Cerrado)
//var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41');
//var bioma250mil = biomes.mask(biomes.eq(2));
//Map.addLayer(bioma250mil, {}, 'Bioma Raster', false); // Adiciona a camada do bioma ao mapa, inicialmente desligada

// Define os anos que serão analisados
var anos = [1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,
            1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,
            2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,
            2021,2022,2023, 2024];

// Loop que processa as imagens de floresta e não floresta para cada ano
for (var i_ano = 0; i_ano < anos.length; i_ano++) {
    var ano = anos[i_ano];

    // Carrega a máscara de floresta e de não floresta para o ano atual
//    var forestMask_ano = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col9/forestMask85a23_100m_v1')
//                           .select('forest_' + ano);
    var naturalMask_ano = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/natural_Mask85a24_100m_v2')
                              .select('natural_' + ano);

    // Calcula o número de pixels conectados para as áreas de floresta e não floresta (1024 pixels, conectados em 8 direções)
//    var con_forest = forestMask_ano.selfMask().connectedPixelCount(1024, true).reproject('epsg:4326', null, 100);
    var con_nonforest = naturalMask_ano.selfMask().connectedPixelCount(1024, true).reproject('epsg:4326', null, 100);

    // Adiciona as bandas de conectividade às máscaras de floresta e não floresta
//    forestMask_ano = forestMask_ano.addBands(con_forest.rename('conect_' + ano));
    naturalMask_ano = naturalMask_ano.addBands(con_nonforest.rename('conect_' + ano));

    // Inicializa ou adiciona as bandas aos dados combinados para todos os anos
    if (i_ano == 0) { 
//        var forestMask85a23_100m_conn = forestMask_ano;
        var naturalMask85a24_100m_conn = naturalMask_ano;
    } else {
//        forestMask85a23_100m_conn = forestMask85a23_100m_conn.addBands(forestMask_ano);
        naturalMask85a24_100m_conn = naturalMask85a24_100m_conn.addBands(naturalMask_ano);
    }
}

// Exibe as máscaras finais no console
//print('forestMask85a23_100m_conn', forestMask85a23_100m_conn);
print('naturalMask85a24_100m_conn', naturalMask85a24_100m_conn);

// Define o diretório de saída para a exportação das imagens
var dirout = 'projects/mapbiomas-workspace/DEGRADACAO/ISOLATION_col101_v2/';


// Exporta a máscara de não floresta com conectividade para o asset do usuário
Export.image.toAsset({
    "image": naturalMask85a24_100m_conn.toInt16(),
    "description": 'natural_Mask85a24_100m_v'+v_out+'_conn',
    "assetId": dirout + 'natural_Mask85a24_100m_v'+v_out+'_conn',
    "scale": 100,
    "pyramidingPolicy": {'.default': 'mode'},
    "maxPixels": 1e13,
    "region": geometry
});
