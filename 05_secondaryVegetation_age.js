// export secondary vegetation age by cover type
// dhemerson.costa@ipam.org.br
 
// set version
var version = 1;

// read coverage by mapbiomas collection 8 
var coverage = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1');

// read age fire by mapbiomas fogo collection 2.1
var age = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_secondary_vegetation_age_v1');

// set native classes
var native_classes = [3, 4, 5, 6, 11, 12, 49, 50];

// build empty recipe
var recipe = ee.Image([]);

// set years
var years = [1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
             1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006,
             2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
             2018, 2019, 2020, 2021, 2022, 2023];

// for each year
years.forEach(function(year_i) {
  // get sec veg age
  var sec_i = age.select('secondary_vegetation_age_' + year_i)
    .multiply(100)
    .selfMask();
  
  // get cover
  var cover_i = coverage.select('classification_' + year_i)
    // select native classes
    .remap({'from': native_classes,
            'to': native_classes,
            'defaultValue': 0
    }).selfMask();

  // combine sec veg age and cover into a unique id 
  var xi = sec_i.add(cover_i);
  
  //Map.addLayer(sec_i, {}, 'sec_i' + year_i);
  //Map.addLayer(cover_i, {}, 'cover_i' + year_i);
  //Map.addLayer(xi, {}, 'xi ' + year_i);
  
  // store
  recipe = recipe.addBands(xi.rename('age_' + year_i));
  
});

print(recipe);

// export
Export.image.toAsset({
	image: recipe,
  description: 'secondary_vegetation_age_col9_v' + version,
  assetId: 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/secondary_vegetation/' + 'secondary_vegetation_age_col9_v' + version,
  region: coverage.geometry(),
  pyramidingPolicy:'mode',
  scale: 30,
  maxPixels: 1e13,
});
