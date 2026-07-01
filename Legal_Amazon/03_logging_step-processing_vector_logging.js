// ---------------------------------------------------------------------------------------------------------------

var poligonos = ee.ImageCollection('projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/LOGGIN')
                .filter(ee.Filter.eq("version", "5"));

// 1. Definir o intervalo de anos
var anos = [];
for (var i = 1988; i <= 2023; i++) {
  anos.push(i);
}

// 2. Função para processar e exportar cada ano
anos.forEach(function(ano) {

  var img = poligonos.filter(ee.Filter.eq("year", ano)).first();

  var vetores = img.reduceToVectors({
                        reducer: ee.Reducer.countEvery(),
                        geometry: geometry,
                        geometryType: 'polygon',
                        scale:30, 
                        maxPixels:1e13});
                        
  Map.addLayer(vetores);
  
  Export.table.toDrive({
    collection: vetores,
    description: 'v3_loggin_vetorizado_' + ano,
    folder: 'MAPBIOMAS_LOGGIN_SHP',
    fileNamePrefix: 'v3_loggin_vetorizado_' + ano,
    fileFormat: 'SHP'
  });
});

