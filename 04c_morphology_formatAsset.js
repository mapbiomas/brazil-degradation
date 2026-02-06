// prepare patch ID and patch size assets as ee.Image
// dhemerson.costa@ipam.org.br

// set version
var collectionId = 10;
var version = 1;

// set patch id folder
var patchMorphology = ee.ImageCollection('projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/morphology')
  .toBands();

// Set years to be processed 
var years_list = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
                  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
                  2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                  2018, 2019, 2020, 2021, 2022, 2023, 2024];

// define recipes
var recipeMorphology = ee.Image([]);

// for each year
years_list.forEach(function(year_i) {
  
  // bind patchID
  recipeMorphology = recipeMorphology.addBands(
    patchMorphology.select('nativeMask_classification_' + year_i + '_morphology_b1')
      .rename('morphology_' + year_i)
      .selfMask()
    );
    
});

// format dataType
recipeMorphology = recipeMorphology.uint8();

// inspect
print(recipeMorphology);
Map.addLayer(recipeMorphology.select('morphology_2024'), {palette:['#179751', '#9BCFB3', '#46A9B1', '#FFCC4A', '#F6B0CB', '#A9DBEB'], min:1, max:6}, 'morphology');

// Export
Export.image.toAsset({
	image: recipeMorphology,
  description: 'degradation_patch_morphology_col' + collectionId + '_v' + version,
  assetId: 'projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/public/' + 'degradation_patch_morphology_col' + collectionId + '_v' + version,
  region: patchMorphology.geometry(),
  scale: 30,
  maxPixels: 1e13,
  priority: 999
});
