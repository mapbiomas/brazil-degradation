<div>
    <img src='https://github.com/mapbiomas/brazil-degradation/blob/main/utils/logo_mapbiomas_Degradation.png?raw=true' height='auto' width='400' align='center'>
    <h1>Brazil's Degradation Module</h1>
</div>

## About
Welcome to the Degradation Driver Layers repository for the MapBiomas Degradation Module. This repository contains the source code used to generate spatial layers that identify key drivers of native vegetation degradation across Brazil. All layers were produced using data from MapBiomas Land Cover and Land Use Collection 9 and MapBiomas Fire Collection 3. For a comprehensive overview of the methodology, please refer to the [Algorithm Theoretical Basis Document (ATBD)](https://brasil.mapbiomas.org/wp-content/uploads/sites/4/2024/07/atbd-modulo-beta-degradacao.pdf)

Below, we provide a brief overview of the methodology used to generate each of the degradation driver layers.
### Edge area
First, we utilized annual land use and land cover data from Collection 8,  then we standardized the native vegetation classes to a single class for each year to avoid edge area between different  vegetation types. For example, areas of Savanna Formation do not produce edge areas over areas of Forest Formation. Furthermore, we considered that Rocky Outcrop (ID 29), Hypersaline Tidal Flat (32), and Water (33) classes should also not generate edge areas over native vegetation classes. We thentreated all anthropic use classes as a single class and employed the `ee.Kernel.euclidean()` function in Google Earth Engine to calculate the distance of edge areas over native vegetation. This was achieved by considering buffers of 30, 60, 90, 120, 150, 300, 600, and 1000 meters. It is important to note that we did not differentiate or weigh the edge area based on its source (e.g., Pasture, Agriculture, or Urban). All the buffers were considered equal, regardless of the source class. 

### Small-sized patches
We utilized land use and land cover maps from Collection 8 and applied a systematic approach to consolidate native vegetation classes into a single class each year. This method ensures that spatially connected native vegetation types are treated as a single patch. In the case of Pantanal, the water class was also considered as “pseudo” native vegetation in the algorithm. Subsequently, by using the `.connectedPixelCount()` function in Google Earth Engine, we computed the area of each native vegetation patch in hectares. The patches were then categorized based on their area: patches equal to or less than 3 hectares (ha), 5 ha, 10 ha, 25 ha, 50 ha, and 75 ha. All patches larger than 75 ha were excluded from this data layer.

### Habitat isolation
We defined three variables to be used in the analysis, each one with three factors:
1. **Size of Target Patch**: Area equal to or less than 25 hectares (ha), 50 ha, or 100 ha. The higher the value, the greater the number of fragments considered isolated.
2. **Distance to Source Patch**: Distance equal to or more than 5 kilometers (km), 10 km, or 20 km. Distance here represents a threshold of isolation tolerance. Therefore, lower values ​​indicate less tolerance, resulting in a greater number of isolated fragments in the landscape.
3. **Size of Source Patch**: Area equal to or greater than 100 ha, 500 ha, or 1000 ha. The higher the value, the smaller the number of source fragments in the landscape, resulting in a greater number of isolated fragments.
    
To process this information in Google Earth Engine, we followed the steps:
- **Resampling Data**: We  resampled the data from Collection 8 with a spatial resolution of 30m to 100m. 
- **Exporting Native Vegetation Data**: We  exported  native vegetation data grouped into two categories:  “forest” (including Forest Formation, Savanna Formation, Mangrove, Flooded Forest, and Wooded Sandbank Vegetation) and “Non-Forest” (including Wetland, Grassland, and Herbaceous Sandbank Vegetation).  Exclusively for the Pantanal, the water class was also considered a ‘pseudo’ native vegetation as Non-Forest. 
- **Creating Connected Natural Areas Mask**: We  exported a mask of connected natural areas with up to 1024 pixels, which allowed us  to separate forest and non-forest areas into categories of more than 100 hectares (100 pixels), 500 hectares (500 pixels), and 1,000 hectares (1,000 pixels), representing the “source patch” maps. 
- **Generating Distance Map**: `Using the ee.Kernel.euclidean()` distance function in the Google Earth Engine, we generated a distance map from source patches, classifying distances into categories of equal to or greater than 5km, 10km, and 20km. 
- **Removing Large Fragments**: We used the same databases  as a mask to remove all fragments over 100 hectares. This generated a database of natural areas with an area equal to or less than 100 hectares.
- **Reclassifying Target Fragments**: The remaining natural areas were  reclassified to generate the layer of target fragments: natural areas with an area equal to or less than 25 hectares, 50 ha, and 100 ha.

### Fire
The burned area frequency maps represent how many times the same pixel was mapped as burned over a period from 1985 to 2022. Fire frequency data is aggregated into a single map with 38 classes: Class 1 represents pixels that burned once, Class 2 represents pixels that burned twice, and so on.
To create these maps, we retrieved yearly burned areas from MapBiomas Fire Collection 2. We computed the fire frequency by binarizing yearly burned areas for each year (1= burned, 0= unburned) and summing the fire occurrences across years. This data also includes the land use and cover classes from MapBiomas Collection 9 for the last year. For more details, see the [MapBiomas Fire ATBD](https://brasil.mapbiomas.org/wp-content/uploads/sites/4/2023/08/ATBD_-_MapBiomas_Fogo_-_Colecao_2.pdf).

### Secondary Vegetation
Using the MapBiomas Deforestation and Secondary Vegetation dataset (see [Deforestation and Secondary Vegetation ATBD](https://brasil.mapbiomas.org/wp-content/uploads/sites/4/2024/04/Deforestation-_-Secondary-Vegetation-Appendix-ATBD-Collection-8.docx.pdf)), we map the regrowth of native vegetation by year and compute the age (in years) of regrowth for each pixel.
The process is as follows:
1. Initial Mapping: Identify areas of deforestation and secondary vegetation for each year using the MapBiomas dataset.
2. Regrowth Calculation: For each year following deforestation, increment the regrowth age of each pixel by +1. This is done annually, starting from the year of deforestation.
3. Age Computation: The age of regrowth for each pixel is determined by summing the years of regrowth. For example, if a pixel was deforested in 2010 and identified as secondary vegetation in subsequent years, by 2022, the pixel would have 12 years of regrowth.

This method allows for the calculation of the precise age of secondary vegetation regrowth for each pixel, providing valuable information on the recovery and resilience of ecosystems over time.

## How to use 
1. [Create an account](https://signup.earthengine.google.com/) in Google Earth Engine plataform.
2. Download or clone this repository to your local workspace.

## Contact
For clarification or issue/bug report, please write to <dhemerson.costa@ipam.org.br>


