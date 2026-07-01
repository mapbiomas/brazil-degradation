var amaz_legal = ee.FeatureCollection('projects/imazon-simex/SAD/DATABASE/VECTOR/AMZ_legal');
var supergrids = ee.FeatureCollection('projects/imazon-simex/SAD/DATABASE/VECTOR/AMZ_grid');
var grid       = ee.FeatureCollection('projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/DENSIDADE/dam_2024_grid');

var simex = ee.FeatureCollection('projects/ee-brunoferreira/assets/simex_2007_2023');
var inpe  = ee.FeatureCollection('projects/ee-simex/assets/deter_amz_cs_2016_2026')
              .map(function(f){ return f.set('year', ee.Date(f.get('VIEW_DATE')).get('year')); });
var s1    = ee.FeatureCollection('projects/ee-simex/assets/SimexAmz2020_2024');
var s2    = ee.FeatureCollection('projects/ee-simex/assets/exp_mad_simex_PA_2007_2023');
var s3    = ee.FeatureCollection('projects/ee-simex/assets/mt_exploracao_madeireira_total_2007_a_2022_imazon_icv_sema');

// ── Ano de análise ──────────────────────────────────────────
var ano    = 2024;
var anoStr = String(ano);

// ── Distúrbios ──────────────────────────────────────────────
var dist = ee.FeatureCollection([]);
if (ano >= 2007 && ano <= 2023) dist = dist.merge(simex.filter(ee.Filter.eq('ano', anoStr)));
if (ano >= 2016)                dist = dist.merge(inpe.filter(ee.Filter.eq('year', ano)));
dist = dist.merge(s1.filter(ee.Filter.eq('Ano', anoStr)));
dist = dist.merge(s2.filter(ee.Filter.eq('Ano', anoStr)));
dist = dist.merge(s3.filter(ee.Filter.eq('Ano', anoStr)));
if (ano >= 2015 && ano <= 2024)
  dist = dist.merge(ee.FeatureCollection(
    'projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/MASK_RUIDOS/y' + anoStr + '_v2'));

// ── Cruzamento ──────────────────────────────────────────────
var supergridsDist = supergrids.filterBounds(dist.geometry());
var gridsDist      = grid.filterBounds(dist.geometry());

// ── Visualização ────────────────────────────────────────────

Map.addLayer(amaz_legal.style({ fillColor: '006400aa', color: '006400', width: 1 }),
  {}, 'Amazônia Legal');

Map.addLayer(supergridsDist.style({ fillColor: 'ffa65755', color: 'ffa657', width: 1 }),
  {}, 'Supergrids com distúrbio');

Map.addLayer(gridsDist.style({ fillColor: 'cc441166', color: 'cc4411', width: 0.5 }),
  {}, 'Grids que cruzam distúrbio');

Map.addLayer(dist.style({ fillColor: 'ff000066', color: 'ff0000', width: 0.8 }),
  {}, 'Distúrbios ' + ano);

// ── Legenda ─────────────────────────────────────────────────
var legend = ui.Panel({ style: { position: 'bottom-left', padding: '8px 12px', backgroundColor: '#0d1117' } });

legend.add(ui.Label('SIMEX · ' + ano, {
  fontWeight: 'bold', fontSize: '13px', color: '#06d6a0', fontFamily: 'monospace', margin: '0 0 8px 0'
}));

function legRow(cor, txt) {
  return ui.Panel({
    widgets: [
      ui.Panel({ style: { width: '16px', height: '16px', backgroundColor: cor, margin: '1px 8px 0 0' } }),
      ui.Label(txt, { fontSize: '11px', color: '#e6edf3', fontFamily: 'monospace' })
    ],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: { margin: '3px 0' }
  });
}

legend.add(legRow('#006400', 'Amazônia Legal'));
legend.add(legRow('#ffa657', 'Supergrids com distúrbio'));
legend.add(legRow('#cc4411', 'Grids que cruzam distúrbio'));
legend.add(legRow('#ff0000', 'Distúrbios ' + ano));

Map.add(legend);

// ── Exportação ──────────────────────────────────────────────
Export.table.toAsset({
  collection:  gridsDist,
  description: 'grids_disturbio_' + ano,
  assetId:     'projects/mapbiomas-workspace/TRANSVERSAIS/AMAZONIA/DEGRADACAO/DENSIDADE/grids_disturbios/y' + ano
});

Export.table.toDrive({
  collection:  gridsDist,
  description: 'grids_disturbio_' + ano,
  folder:      'GEE_SIMEX',
  fileFormat:  'SHP'
});