var year = 2020;
var damCollection = ee.ImageCollection("projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/LOGGIN-DENSITY");
var damClassification = ee.ImageCollection("projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/LOGGIN-CLASSIFICATION").filter(ee.Filter.eq("version", "4"));
var logging = ee.Image("projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/public/logging_v2");

var damYear = damCollection.filter(ee.Filter.eq("year", year)).first();
var damClassificationYear = damClassification.filter(ee.Filter.eq("year", year)).first();
var loggingYear = logging.select("logging_" + year).unmask();

damClassificationYear = damClassificationYear.remap([1,2,3,4,5,6,7],[1,2,1,1,3,4,5]);

var survive_24 = damClassificationYear.eq(2).or(damClassificationYear.eq(4))
                   .and(damYear.gt(3));

var survive_3 = damClassificationYear.eq(3)
                   .and(damYear.gt(2));

var survive_15 = damClassificationYear.eq(1).or(damClassificationYear.eq(5))
                   .and(loggingYear.eq(1));

var finalMask = survive_24.or(survive_3).or(survive_15);

var damFinal = damYear.updateMask(finalMask);

Map.addLayer(damFinal, {min:1, max:12, palette:['red','orange','yellow']}, 'DAM Final ' + year);

// --- EXPORTAÇÃO (1988–2024) ---
// Para ativar: remova o comentário do bloco abaixo e rode o script.
// Cada ano gera uma tarefa independente na aba Tasks do GEE.

/*
var geometry = ee.Geometry.Polygon(
    [[[-74.36149053985359,  5.712694437304823],
      [-74.36149053985359, -18.554138132757668],
      [-43.5118811648536,  -18.554138132757668],
      [-43.5118811648536,   5.712694437304823]]], null, false);

var listYears = [
    1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999,
    2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011,
    2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024
];

listYears.forEach(function(y) {

    var damY = damCollection.filter(ee.Filter.eq("year", y)).first();
    var classY = damClassification.filter(ee.Filter.eq("year", y)).first();
    var logY = logging.select("logging_" + y).unmask();

    classY = classY.remap([1,2,3,4,5,6,7],[1,2,1,1,3,4,5]);

    var s24 = classY.eq(2).or(classY.eq(4)).and(damY.gt(3));
    var s3  = classY.eq(3).and(damY.gt(2));
    var s15 = classY.eq(1).or(classY.eq(5)).and(logY.eq(1));

    var dam = damY.updateMask(s24.or(s3).or(s15)).set('year', y);

    Export.image.toAsset({
        image:       dam,
        description: 'canopy_disturbance_' + y,
        assetId:     'projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/CANOPY-DISTURBANCE/disturbance_' + y,
        region:      geometry,
        pyramidingPolicy: {'.default': 'MODE'},
        scale:       30,
        maxPixels:   1e13
    });
});
*/