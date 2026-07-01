var geometry = 
    /* color: #d63000 */
    /* shown: false */
    ee.Geometry.Polygon(
        [[[-58.83714224194604, -6.8958090011156585],
          [-59.35075308178979, -7.318257317920796],
          [-59.55674673413354, -7.378185859958233],
          [-59.72703482007104, -7.432659311915942],
          [-60.07859732007104, -7.623262876424037],
          [-60.216636711111036, -7.822454926373374],
          [-60.342979484548536, -8.273895711753484],
          [-60.44029829901815, -8.305851595494005],
          [-60.56114790839315, -8.316722537847426],
          [-60.56114790839315, -8.650854981807054],
          [-60.16564009589315, -9.090478111832159],
          [-59.93492720526815, -9.123021653275236],
          [-59.4872343341744, -8.979265423388846],
          [-58.89671919745565, -8.930429538462496],
          [-58.70995161933065, -8.946708895352135],
          [-58.4105741779244, -8.935856071585906],
          [-58.10021040839315, -8.968413571633267],
          [-57.8392851154244, -8.984691227504301],
          [-57.4218046466744, -8.881587111689704],
          [-57.0427763263619, -8.962987524088055],
          [-56.86974165839315, -9.02266957898837],
          [-56.61156294745565, -9.011819028560812],
          [-56.50258150652013, -9.089691945995948],
          [-56.476488977223255, -9.111388017259532],
          [-56.377612024098255, -9.116811829331049],
          [-56.317187219410755, -9.119523704472599],
          [-56.21419039323888, -9.164266665186704],
          [-56.023302942067005, -9.222559638192624],
          [-55.93129244402013, -9.240181202419025],
          [-55.76707066440316, -9.268685966929372],
          [-55.67867706470277, -9.36796035257618],
          [-55.493212610035755, -9.463085059108733],
          [-55.08809176042638, -9.481371711623675],
          [-54.93977633073888, -9.494916751861238],
          [-54.809313684254505, -9.481371711623675],
          [-54.80794039323888, -9.348602129843979],
          [-54.76384533559215, -9.305743092604349],
          [-54.7281397691859, -9.205442641159308],
          [-54.762472044576526, -9.042732889330999],
          [-54.9039210191859, -8.83110041528857],
          [-54.957479368795276, -8.780887599639168],
          [-55.16484631215465, -8.783601980034621],
          [-55.311788450826526, -8.718451380245845],
          [-55.416158568014026, -8.6719110933014],
          [-55.421651732076526, -8.587731023549397],
          [-55.523275267232776, -8.51168134987885],
          [-55.613912474264026, -8.416598024812632],
          [-55.693563353170276, -8.38127539962656],
          [-55.696309935201526, -8.350025786867738],
          [-55.795186888326526, -8.278006299803815],
          [-55.73064221059215, -8.273929330082083],
          [-55.73064221059215, -8.24538936192292],
          [-55.7993067613734, -8.10401833564451],
          [-55.948995482076526, -8.027874841374597],
          [-56.174757003164096, -8.03808856756364],
          [-56.369764327382846, -7.929290136934973],
          [-56.493360518789096, -7.929290136934973],
          [-56.644422530507846, -7.910247441454503],
          [-56.7501331179574, -7.848506144128734],
          [-56.80094488553552, -7.716523908019197],
          [-56.85038336209802, -7.618531028325895],
          [-56.99015861564553, -7.542298827706053],
          [-57.05333000236428, -7.550467208287253],
          [-57.25108390861428, -7.411583879472093],
          [-57.42411857658303, -7.215438908781694],
          [-57.65483146720803, -7.035564584758004],
          [-57.66307121330178, -6.912882920809751],
          [-57.71525627189553, -6.781987379719507],
          [-58.16020256095803, -6.591034468664288],
          [-58.56669670158303, -6.686520250188674],
          [-58.73423820548928, -6.784714735324369]]]),
    geometry2 = 
    /* color: #98ff00 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-74.36149053985359, 5.712694437304823],
          [-74.36149053985359, -18.554138132757668],
          [-43.5118811648536, -18.554138132757668],
          [-43.5118811648536, 5.712694437304823]]], null, false);

/* * CONFIGURAÇÃO DO PERÍODO
*/
var anos = ee.List([1997,1998,2000,2007]).getInfo();

// 1. Carregar bases fixas (que não dependem do ano do loop) fora do laço
var montanha_vis = ee.Image("projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/relevo-topo-de-morro");
var mask = ee.Image("projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/mask");
var areasUmidas = ee.Image("projects/mapbiomas-raisg/MAPBIOMAS-WETLANDS/AmazonWetlandMap").gte(1).selfMask();

// Antropização fixa (referência 2020 conforme seu original)
var antr = ee.Image("projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1")
           .select("classification_2020")
           .remap([15,18,19,39,20,40,62,41,36,46,47,35,48,9,21,25,24,30],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]);

var b_antr = antr.unmask(0).gt(0); 
var distancia = 300; 
var antr_expandido = b_antr.focal_max({radius: distancia, units: 'meters'});

// Iteração para cada ano
anos.forEach(function(year) {
  
  // INPUTS POR ANO
  var image = ee.Image("projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/LOGGIN-DENSITY/dam_" + year);
  
  var floresta = ee.Image("projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1")
                .select("classification_" + year).eq(3).selfMask().multiply(3);
  
  var b_floresta = floresta.unmask(0).gt(0);
  var floresta_expandida = b_floresta.focal_max({radius: distancia, units: 'meters'});
  var borda_dupla = antr_expandido.and(floresta_expandida).selfMask();

  // DISTÚRBIO DE DOSSEL
  var damTotal = image.gt(0).selfMask();

  var damClassificado = damTotal
                        .where(montanha_vis, 6)
                        .where(borda_dupla, 7)
                        .where(areasUmidas, 5);

  // SEPARAÇÃO DE FRAGMENTOS
  var roxo_binario = damClassificado.eq(1); 
  var tamanho_minimo_fogo = 30; 

  var patches = roxo_binario.connectedPixelCount({
    maxSize: 300, 
    eightConnected: true
  });

  var fogo = patches.gte(tamanho_minimo_fogo).selfMask();
  var madeira_ruido = roxo_binario.updateMask(fogo.unmask(0).not()).selfMask().updateMask(floresta);

  // CLASSIFICAÇÃO FINAL
  var limpar = ee.Image(1).clip(geometry);

  var finalClass = damClassificado
                    .where(fogo, 2)
                    .where(madeira_ruido.and(mask.eq(0)), 4)
                    .where(madeira_ruido.and(mask.eq(1)), 3)
                    .where(areasUmidas, 5);

  finalClass = finalClass.where(limpar.and(finalClass.eq(1)), 4);
  
  // Visualização (Apenas do último ano para não sobrecarregar o browser, ou remova o if para ver todos)
  if (year === 1997) {
    Map.addLayer(finalClass, {min:1, max:7, palette:['purple', '#802222', 'orange','black','cyan','red','yellow']}, 'DAM ' + year);
  }

  // EXPORT
  Export.image.toAsset({
    image: finalClass.set('year', year).set('version', '2'),
    description: 'classification_' + year + '_2',
    assetId: 'projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/LOGGIN-CLASSIFICATION/classification_' + year + '_2', 
    region: geometry2,
    scale: 30, 
    pyramidingPolicy: {'.default': 'mode'},
    maxPixels: 1e13
  });
  
});