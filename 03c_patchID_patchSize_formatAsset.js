// prepare patch ID and patch size assets as ee.Image
// dhemerson.costa@ipam.org.br

// set version
var collectionId = 101;
var version = 2;

// set patch id folder
var patchID = ee.ImageCollection('projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/patch-id-v2')
  .toBands();

var patchSize = ee.ImageCollection('projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/patch-size-all-v2')
  .toBands();
  print(patchSize)

// Set years to be processed 
var years_list = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
                  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
                  2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
                  2018, 2019, 2020, 2021, 2022, 2023, 2024];

// define recipes
var recipeID = ee.Image([]);
var recipeSize = ee.Image([]);

// for each year
years_list.forEach(function(year_i) {
  
  // bind patchID
  recipeID = recipeID.addBands(
    patchID.select('fragment_id_' + year_i + '_b1')
      .rename('id_' + year_i)
      .selfMask()
      .round()
    );
  
  // bind patch size
  recipeSize = recipeSize.addBands(
    patchSize.select('fragment_area_' + year_i + '_b1')
      .rename('size_' + year_i)
      .selfMask()
      .round()
    );
});

// format dataType
recipeID = recipeID.int32();
recipeSize = recipeSize.int32();

// inspect
print(recipeID, recipeSize);
Map.addLayer(recipeID.select('id_2024').randomVisualizer(), {}, 'id');
Map.addLayer(recipeSize.select('size_2024'), {palette:['red', 'yellow', 'green'], min: 5, max: 5000}, 'size');

// Export
Export.image.toAsset({
	image: recipeID,
  description: 'degradation_patch_id_col' + collectionId + '_v' + version,
  assetId: 'projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/public/' + 'degradation_patch_id_col' + collectionId + '_v' + version,
  region: patchID.geometry(),
  scale: 30,
  maxPixels: 1e13,
  priority: 999
});

Export.image.toAsset({
	image: recipeSize,
  description: 'degradation_patch_size_col' + collectionId + '_v' + version,
  assetId: 'projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/public/' + 'degradation_patch_size_col' + collectionId + '_v' + version,
  region: patchSize.geometry(),
  scale: 30,
  maxPixels: 1e13,
  priority: 999
});
