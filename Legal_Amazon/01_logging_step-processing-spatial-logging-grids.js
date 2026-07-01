var point = /* color: #d63000 */ee.Geometry.Point([-55.501808879699446, -10.985366482595866]);

var geometry = ee.FeatureCollection("projects/imazon-simex/SAD/DATABASE/VECTOR/AMZ_grid").filterBounds(point);

var BAND   = 2024;
var SCALE  = 30;
var GRID_M = 256 * 30;

// ============================================================
// 1. BASE IMAGE
// ============================================================

var damClassification = ee.ImageCollection("projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/LOGGIN-CLASSIFICATION").filter(ee.Filter.eq("version", "4"));
var damClassificationYear = damClassification.filter(ee.Filter.eq("year", BAND)).first();
damClassificationYear = damClassificationYear.remap([1,2,3,4,5,6,7],[1,2,1,1,3,4,5]);

var full = ee.ImageCollection(
  'projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/LOGGIN-DENSITY'
).filter(ee.Filter.eq("year", BAND)).first().updateMask(damClassificationYear.eq(1));

var disturbance = full.updateMask(
  full.gt(0).and(ee.Image.constant(1).clip(geometry).unmask(0))
);

var anyDist = disturbance.gt(0);

// ============================================================
// 2. KERNEL CRITERIA
// ============================================================

// Neighbors 3x3 (excludes center pixel)
var neighborKernel = ee.Kernel.fixed({
  width: 3, height: 3,
  weights: [[1,1,1],[1,0,1],[1,1,1]],
  x: 1, y: 1
});
var neighbors = anyDist.unmask(0).convolve(neighborKernel)
                        .updateMask(anyDist).rename('neighbors');
var neighborMask = neighbors.gte(1).and(neighbors.lte(6));

// Moderate frequency (1–4 years disturbed)
var freqMask = disturbance.gte(1).and(disturbance.lte(4));

// Patch size (GEE max = 1024)
var patchSize = anyDist.connectedPixelCount(1024, false);
var patchMask = patchSize.gte(5).and(patchSize.lte(1023));

// Local density 5x5 (150m)
var density5 = anyDist.unmask(0).reduceNeighborhood({
  reducer: ee.Reducer.mean(), kernel: ee.Kernel.square(2)
}).updateMask(anyDist).rename('density5');
var densMask5 = density5.gte(0.10).and(density5.lte(0.75));

// Regional density 11x11 (330m)
var density11 = anyDist.unmask(0).reduceNeighborhood({
  reducer: ee.Reducer.mean(), kernel: ee.Kernel.square(5)
}).updateMask(anyDist).rename('density11');

// Local/regional density ratio
var densityRatio = density5.divide(density11.add(0.001));
var ratioMask    = densityRatio.gte(0.8);

// Low spatial variance (homogeneous = not fire edge)
var freqVar     = disturbance.unmask(0).reduceNeighborhood({
  reducer: ee.Reducer.variance(), kernel: ee.Kernel.square(3)
}).updateMask(anyDist);
var notFireEdge = freqVar.lt(5);

// ============================================================
// 3. FINAL MASK
// ============================================================
var cuttingMask = anyDist
  .and(freqMask)
  .and(neighborMask)
  .and(patchMask)
  .and(densMask5)
  .and(ratioMask)
  .and(notFireEdge)
  .rename('selective_logging');

// ============================================================
// 4. GRID
// ============================================================
var proj  = ee.Projection('EPSG:32721').atScale(GRID_M);
var tiles = geometry.geometry().coveringGrid(proj);

var stats = ee.Image.cat([
  disturbance.rename('freq_raw'),
  cuttingMask,
  density5,
  patchSize
]).reduceRegions({
  collection: tiles,
  reducer: ee.Reducer.mean()
             .combine(ee.Reducer.sum(), null, true)
             .combine(ee.Reducer.max(), null, true),
  scale: SCALE,
  crs: 'EPSG:4326'
});

var statsClassified = stats.map(function(f) {
  var pctLogging = ee.Number(f.get('selective_logging_mean'));
  var cls = ee.Number(ee.Algorithms.If(pctLogging.gt(0.03), 1, 0));
  return f.set('grid_class', cls, 'pct_logging', pctLogging);
});

// ============================================================
// 5. BACKGROUND
// ============================================================
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(geometry)
  .filterDate('2024-06-01', '2024-09-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median()
  .clip(geometry);

var ndvi = s2.normalizedDifference(['B8','B4']).rename('ndvi');

// ============================================================
// 6. MAP LAYERS
// ============================================================
Map.centerObject(geometry, 11);
Map.setOptions('SATELLITE');

Map.addLayer(ndvi, {
  min: 0.2, max: 0.85,
  palette: ['#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#005a32']
}, 'Vegetation (NDVI)', true, 0.5);

Map.addLayer(disturbance, {
  min: 1, max: 10,
  palette: ['#FFFFB2','#FECC5C','#FD8D3C','#F03B20','#BD0026']
}, 'Disturbance frequency', true, 0.7);

Map.addLayer(cuttingMask.selfMask(), {
  palette: ['#00E676']
}, 'Selective logging pixels', true, 1.0);

Map.addLayer(
  statsClassified.filter(ee.Filter.eq('grid_class', 1))
    .style({color: '00E676', fillColor: '00E67620', width: 2}),
  {}, 'Grids — selective logging'
);

Map.addLayer(
  tiles.style({color: '555555', fillColor: '00000000', width: 1}),
  {}, 'Grid 7.68 km'
);

// ============================================================
// 7. LEGEND — light theme
// ============================================================
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '10px 14px',
    backgroundColor: 'rgba(255,255,255,0.92)',
    border: '1px solid rgba(0,0,0,0.15)',
    width: '230px'
  }
});

legend.add(ui.Label('Selective Logging Detection · 2024', {
  fontWeight: 'bold', fontSize: '13px',
  color: '#212121', margin: '0 0 8px 0'
}));

legend.add(ui.Label('Disturbance frequency (months)', {
  fontSize: '11px', color: '#666666', margin: '0 0 3px 0'
}));

var freqBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select('longitude')
    .multiply(10).toInt()
    .visualize({min:1, max:10, palette:['#FFFFB2','#FECC5C','#FD8D3C','#F03B20','#BD0026']}),
  params: {bbox:'0,0,1,0.1', dimensions:'190x14'},
  style: {stretch:'horizontal', margin:'0 0 2px 0', maxHeight:'14px'}
});
legend.add(freqBar);

legend.add(ui.Panel({
  widgets: [
    ui.Label('1 yr',   {fontSize:'10px', color:'#666666', margin:'0'}),
    ui.Label('5 yrs',  {fontSize:'10px', color:'#666666', margin:'0', textAlign:'center', stretch:'horizontal'}),
    ui.Label('10 yrs', {fontSize:'10px', color:'#666666', margin:'0'})
  ],
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {stretch:'horizontal', margin:'0 0 10px 0'}
}));

legend.add(ui.Label('───────────────────────', {
  fontSize:'9px', color:'#CCCCCC', margin:'0 0 6px 0'
}));

var makeRow = function(color, label, description) {
  var box = ui.Label({
    style: {
      backgroundColor: color,
      padding: '6px 10px',
      margin: '0 8px 0 0',
      border: '1px solid rgba(0,0,0,0.15)'
    }
  });
  var txt = ui.Panel({
    widgets: [
      ui.Label(label,       {fontSize:'11px', fontWeight:'bold', color:'#212121', margin:'0'}),
      ui.Label(description, {fontSize:'10px', color:'#666666',   margin:'1px 0 0 0'})
    ],
    layout: ui.Panel.Layout.flow('vertical')
  });
  return ui.Panel({
    widgets: [box, txt],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin:'3px 0'}
  });
};

legend.add(makeRow('#00E676',   'Selective logging', 'candidate pixels (kernel)'));
legend.add(makeRow('#00E67640', 'Grid — logging',    'tile with >3% logging px'));
legend.add(makeRow('#88888840', 'Grid boundary',     '256×256 px / 7.68 km tile'));
legend.add(makeRow('#238443',   'Forest (NDVI)',     'Sentinel-2 SR · Jun–Sep 2024'));

legend.add(ui.Label('───────────────────────', {
  fontSize:'9px', color:'#CCCCCC', margin:'6px 0 4px 0'
}));

legend.add(ui.Label('Detection rules', {
  fontSize:'11px', fontWeight:'bold', color:'#212121', margin:'0 0 4px 0'
}));

var rules = [
  '• Frequency: 1–4 disturbance years',
  '• Neighbors (3×3): 1–6 perturbed px',
  '• Patch size: 5–1023 connected px',
  '• Local density (5×5): 10–75%',
  '• Low spatial variance (not fire)',
  '• Local/regional density ratio ≥ 0.8',
];
rules.forEach(function(r) {
  legend.add(ui.Label(r, {fontSize:'10px', color:'#444444', margin:'1px 0'}));
});

legend.add(ui.Label('───────────────────────', {
  fontSize:'9px', color:'#CCCCCC', margin:'6px 0 4px 0'
}));
legend.add(ui.Label('Source: MapBiomas Degradation Col. 10', {
  fontSize:'9px', color:'#999999', margin:'0'
}));
legend.add(ui.Label('Background: Sentinel-2 SR / Google Satellite', {
  fontSize:'9px', color:'#999999', margin:'2px 0 0 0'
}));

Map.add(legend);

// ============================================================
// 8. TITLE
// ============================================================
var title = ui.Panel({
  style: {
    position: 'top-center',
    padding: '8px 24px',
    backgroundColor: 'rgba(0,0,0,0.75)',
  }
});
title.add(ui.Label('Selective Logging Detection — Mato Grosso · 2024', {
  fontSize: '14px', fontWeight: 'bold', color: '#FFFFFF', margin: '0'
}));
title.add(ui.Label('MapBiomas Degradation Col. 10  ·  Multi-scale kernel algorithm  ·  30m resolution', {
  fontSize: '10px', color: '#AAAAAA', margin: '3px 0 0 0'
}));
Map.add(title);

// ============================================================
// 9. EXPORT
// ============================================================
Export.image.toDrive({
  image: cuttingMask.toByte(),
  description: 'selective_logging_pixels_2024',
  folder: 'GEE_exports',
  region: geometry,
  scale: SCALE,
  maxPixels: 1e9
});
