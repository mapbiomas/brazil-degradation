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
var edge_rules = [50];

// for each edge rule
edge_rules.forEach(function(size_i) {
  
  // read patches for size i
  var patch_i = ee.Image('projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/patch_size/size_' + size_i + 'ha_col9_v1');

  // binarize
  var patch_i_bin = patch_i.gte(1);
  
  // for each year
  var ages_i = ee.Image([]);
  years.forEach(function(year_j) {
    
    // if years is the first, maintain input as they are
    if (year_j == 1985) {
      
      var patch_ij_bin = patch_i_bin.select('size_' + size_i + 'ha_' + year_j);

      ages_i = ages_i.addBands(patch_ij_bin
        .rename('patch_age_' + size_i + 'ha_' + year_j))
        .unmask(0);
        
       // if year is not the first, perform age accumulation 
    } else {
      
      var patch_ij_bin = patch_i_bin.select('size_' + size_i + 'ha_' + year_j);
      var age_past = ages_i.select('patch_age_' + size_i + 'ha_' + String(year_j - 1));
      
      // perform sum 
      var age_ij = ee.Image(0).where(patch_ij_bin.eq(0).and(age_past.eq(0)), 0)
                              .where(patch_ij_bin.eq(0).and(age_past.gte(1)), 0)
                              .where(patch_ij_bin.eq(1).and(age_past.eq(0)), patch_ij_bin)
                              .where(patch_ij_bin.eq(1).and(age_past.gte(1)), age_past.add(patch_ij_bin))
                              .rename('patch_age_' + size_i + 'ha_' + year_j);
      
      // store
      ages_i = ages_i.addBands(age_ij);
      
    }
    

  })
  
  Map.addLayer(ages_i, {}, String(size_i), false)
  
  // overlap age with land cover and land use data 
  var toExport = ee.Image([]);
  years.forEach(function(year_j) {
    
    // read age 
    var age_ijk = ages_i.select('patch_age_' + size_i + 'ha_' + year_j)
    
    // read lulc
    var lulc_ijk = patch_i.select('size_' + size_i + 'ha_' + year_j)
    
    // combine
    var age_lulc_ijk = age_ijk.multiply(100).add(lulc_ijk)
    
    // store
    toExport = toExport.addBands(age_lulc_ijk)
    
  })
  
  Map.addLayer(toExport, {}, 'toExport', false)
  
  // export as asset 
  Export.image.toAsset({
		image: toExport,
    description: 'patch_age_' + size_i + 'ha_col9_v' + version,
    assetId: 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/patch_size/' + 'size_age_' + size_i + 'ha_col9_v' + version,
    region: patch_i.geometry(),
    scale: 30,
    maxPixels: 1e13,
    priority: 999
  });
}) 

