// export multiband image as single band image (one for each year) in the bucket 
// dhemerson.costa@ipam.org.br

// input multiband image address
var address = 'projects/mapbiomas-workspace/DEGRADACAO/COLECAO/BETA/PROCESS/native_mask/nativeMask_col10_v1';

// output bucket 
var bucket_name = 'shared-development-storage';
var bucket_address = 'AUXILIARES/DEGRADACAO/COL_10/temp/';

// function to export image 
function exporting (image,name){
  image.bandNames().evaluate(function(bandnames){
    bandnames.forEach(function(bandname){
      
      Export.image.toCloudStorage({
        image:image.select(bandname), 
        description: name + '-' + bandname,
        bucket:bucket_name,
        fileNamePrefix:bucket_address + name + '-' + bandname, 
        // dimensions:, 
        region:image.geometry(), 
        scale:30,
        // crs, crsTransform, 
        maxPixels:1e13,
        // shardSize, fileDimensions, skipEmptyTiles, 
        fileFormat:'tif',
        // formatOptions, priority
      });
    });
  });
}



// cexport native mask 
var nativeMask = ee.Image(address);
exporting(nativeMask ,'nativeMask');
print('nativeMask', nativeMask);
