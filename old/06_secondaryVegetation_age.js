/**
  Description: Calculates the number of consecutive years that the pixel
  has belonged to the targetClass (e.g., Pasture), counting backwards from
  the last year of the series.

  What it shows: This is crucial for identifying "old" vs. "recent" areas. 
  For example, if the class is Pasture, a high value represents consolidated 
  pasture, while a low value represents a recent conversion.
 */

// Define the MapBiomas asset path
var asset = 'projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_deforestation_secondary_vegetation_v3';

// Target class to be analyzed (1 = binary native classes when mask.gte(1)) 
var targetClass = 1;

//
var collectionId = 101;
var version = 3;

// Prefix used in the image band names
var bandPrefix = 'classification_';

// List of years available in the collection
var years = [
    1987, 1988, 1989, 1990, 1991, 1992,
    1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000,
    2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008,
    2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016,
    2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024
];

// Load the multi-band image (each band represents a year)
var image = ee.Image(asset)

// get classes 3 and 5 of secondary vegetation
image = image.eq(3)
  .or(image.eq(5))        // 1 where value is 3 or 5, else 0
  .selfMask();          // mask out zeros
  
print(image)

// Define a general spectral palette for continuous values
var palette = [
    "#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b",
    "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850"
];

// Import MapBiomas official color modules
var Palettes = require('users/mapbiomas/modules:Palettes.js');
var paletteLulc = Palettes.get('classification9');

/**
 * Calculates the age (consecutive years) of a specific class.
 * @param {ee.Image} image - The multi-band LULC image.
 * @param {number} targetClass - The class value to calculate age for.
 * @param {Array} years - Array of years to iterate through.
 * @param {string} bandPrefix - Prefix of the band names.
 * @returns {ee.Image} - A multi-band image representing the age for each year.
 */
var getClassAge = function (image, targetClass, years, bandPrefix) {

    // Mask only pixels equal to the target class
    var classMask = ee.Image(image).gte(targetClass);

    // Initialize state: running age + accumulated output bands
    var initialState = ee.Dictionary({
        ageImage: ee.Image(0),
        output: ee.Image([])
    });

    // Iteratively calculate age year by year based on class persistence
    var result = ee.List(years).iterate(
        function (year, state) {

            state = ee.Dictionary(state);
            year = ee.Number(year).format('%.0f');

            var ageImage = ee.Image(state.get('ageImage'));
            var output = ee.Image(state.get('output'));

            var currentImageBand = ee.String(bandPrefix).cat(year);
            var currentImage = classMask.select([currentImageBand]).unmask(0);

            // If class exists, add 1 to previous age, otherwise reset to 0
            var currentAge = ageImage.add(1)
                .multiply(currentImage)
                .rename(ee.String('age_').cat(year));

            // Accumulate bands and update state
            return ee.Dictionary({
                ageImage: currentAge,
                output: output.addBands(currentAge)
            });
        },
        initialState
    );

    return ee.Image(ee.Dictionary(result).get('output'));
};

// --- Visualization Section ---

// Original LULC for the latest year
Map.addLayer(image, {
    bands: ['classification_2024'],
    min: 0, max: 69,
    palette: paletteLulc
}, 'LULC 2024', false);


// Class Age (ALL YEARS)
var ages = getClassAge(image, targetClass, years, bandPrefix).selfMask();

// remove primary vegetation which is age == all years length 
// Apply this mask to all age bands
var ages = ages.updateMask(ages.select('age_2024').neq(40));

Map.addLayer(ages , {} , 'Class ' + String(targetClass) + ' Ages');

// Optional: visualize another year
Map.addLayer(ages.select('age_2024'), {
    min: 1, max: years.length,
    palette: palette
}, 'Class ' + String(targetClass) + ' Age 2024', false);

// Inspect full multi-band output
print('All age bands', ages);

// cros with landcover
var recipe = ee.Image([]);
years.forEach(function(year) {
  
  // get age
  var age_i = ages.select('age_' + year)
  
  // get lulc and mask only to secondary vegetation 
  var lulc_i = ee.Image(asset).select('classification_' + year).updateMask(age_i)
  
  // combine
  var result_i = age_i.multiply(100).selfMask()
                      .add(lulc_i)
                      .rename('age_' + year)
                      
  // store
  recipe = recipe.addBands(result_i);
  
})

Map.addLayer(recipe.select('age_2024'), {}, 'stored');
print('output:', recipe)
// export 
// export
Export.image.toAsset({
	image: recipe,
  description: 'degradation_secondaryVegetation_col' + collectionId + '_v' + version,
  assetId: 'projects/mapbiomas-brazil/assets/DEGRADATION/COLLECTION-10/public/' + 'degradation_secondaryVegetation_col' + collectionId + '_v' + version,
  region: image.geometry(),
  pyramidingPolicy:'mode',
  scale: 30,
  maxPixels: 1e13,
});
