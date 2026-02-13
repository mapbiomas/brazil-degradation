// compute the edge age 
// dhemerson.costa@ipam.org.br

// set output version 
var version_in = 1;
var version_out = 1;
var collectionId = 10;

// set filename
var fileName = 'degradation_edge_age_col' + collectionId + '_v' + version_out;

// set years to be processed
var years = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
             1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
             2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
             2018, 2019, 2020, 2021, 2022, 2023, 2024];


  
// read edges for the version i and binarize 
var edge_i_bin = ee.Image('projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/public/degradation_edge_area_col10_v1')
  .gte(1); // binarize

// for each year
var ages_i = ee.Image([]);
years.forEach(function(year_j) {
  
  // if years is the first, maintain input as they are
  if (year_j == 1985) {
    
    var edge_ij_bin = edge_i_bin.select('edge_' + year_j);
    
      ages_i = ages_i.addBands(edge_ij_bin)
      .rename('age_' + year_j)
      .unmask(0);
      
     // if year is not the first, perform age accumulation 
  } else {
    
    var edge_ij_bin = edge_i_bin.select('edge_' + year_j);
    var age_past = ages_i.select('age_' + String(year_j - 1));
    
    // perform sum 
    var age_ij = ee.Image(0).where(edge_ij_bin.eq(0).and(age_past.eq(0)), 0)
                            .where(edge_ij_bin.eq(0).and(age_past.gte(1)), 0)
                            .where(edge_ij_bin.eq(1).and(age_past.eq(0)), edge_ij_bin)
                            .where(edge_ij_bin.eq(1).and(age_past.gte(1)), age_past.add(edge_ij_bin))
                            .rename('age_' + year_j);
    
    // store
    ages_i = ages_i.addBands(age_ij);
    
  }
  
});

ages_i = ages_i.selfMask();
print(ages_i);
Map.addLayer(ages_i.select('age_2024'), {palette: ['green', 'yellow', 'red'], min: 1, max: 35}, 'edge age 2024');
Map.addLayer(ages_i, { }, 'time-series', false);

// insert metadata
ages_i = ages_i.set('territory', 'BRAZIL')
              .set('collection_id', collectionId)
              .set('version', version_out)
              .set('description', 'EDGE AGE');

// export
Export.image.toAsset({
	image: ages_i.int8(),
  description: fileName,
  assetId: 'projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/public/' + fileName,
  region: edge_i_bin.geometry(),
  scale: 30,
  maxPixels: 1e13,
  priority: 999
});
