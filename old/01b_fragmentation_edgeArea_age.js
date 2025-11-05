// compute the edge age 
// dhemerson.costa@ipam.org.br

// set output version 
var version = 1;

// set years to be processed
var years = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
             1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
             2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
             2018, 2019, 2020, 2021, 2022, 2023];

// set edge sizes
var edge_rules = [120];

// for each edge rule
edge_rules.forEach(function(distance_i) {
  
  // read edges for distance i
  var edge_i = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/edge_area/edge_' + distance_i + 'm_col9_v1');
  
  // binarize
  var edge_i_bin = edge_i.gte(1);
  
  // for each year
  var ages_i = ee.Image([]);
  years.forEach(function(year_j) {
    
    // if years is the first, maintain input as they are
    if (year_j == 1985) {
      
      var edge_ij_bin = edge_i_bin.select('edge_' + distance_i + 'm_' + year_j);

      ages_i = ages_i.addBands(edge_ij_bin
        .rename('edge_age_' + distance_i + 'm_' + year_j))
        .unmask(0);
        
       // if year is not the first, perform age accumulation 
    } else {
      
      var edge_ij_bin = edge_i_bin.select('edge_' + distance_i + 'm_' + year_j);
      var age_past = ages_i.select('edge_age_' + distance_i + 'm_' + String(year_j - 1));
      
      // perform sum 
      var age_ij = ee.Image(0).where(edge_ij_bin.eq(0).and(age_past.eq(0)), 0)
                              .where(edge_ij_bin.eq(0).and(age_past.gte(1)), 0)
                              .where(edge_ij_bin.eq(1).and(age_past.eq(0)), edge_ij_bin)
                              .where(edge_ij_bin.eq(1).and(age_past.gte(1)), age_past.add(edge_ij_bin))
                              .rename('edge_age_' + distance_i + 'm_' + year_j);
      
      // store
      ages_i = ages_i.addBands(age_ij);
      
    }
    

  })
  
  Map.addLayer(ages_i, {}, String(distance_i), false)
  
  // overlap age with land cover and land use data 
  var toExport = ee.Image([]);
  years.forEach(function(year_j) {
    
    // read age 
    var age_ijk = ages_i.select('edge_age_' + distance_i + 'm_' + year_j)
    
    // read lulc
    var lulc_ijk = edge_i.select('edge_' + distance_i + 'm_' + year_j)
    
    // combine
    var age_lulc_ijk = age_ijk.multiply(100).add(lulc_ijk)
    
    // store
    toExport = toExport.addBands(age_lulc_ijk)
    
  })
  
  Map.addLayer(toExport, {}, 'toExport', false)
  
  // export as asset 
  Export.image.toAsset({
		image: toExport,
    description: 'edge_age_' + distance_i + 'm_col9_v' + version,
    assetId: 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/edge_area/' + 'edge_age_' + distance_i + 'm_col9_v' + version,
    region: edge_i.geometry(),
    scale: 30,
    maxPixels: 1e13,
    priority: 999
  });

}) 

