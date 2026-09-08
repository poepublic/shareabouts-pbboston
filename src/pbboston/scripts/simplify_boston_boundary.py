import geopandas as gpd
import pathlib

DATA_DIR = pathlib.Path(__file__).parent.parent / 'static' / 'data'

# Load the Boston neighborhoods geojson file. Specify that the incoming CRS is
# 4326. Convert to CRS 26986 (which is an appropriate Massachusetts CRS
# according to https://www.mass.gov/info-details/learn-about-massgis-data).
neighborhoods = gpd.read_file(DATA_DIR / 'City_of_Boston_Boundary.geojson')
neighborhoods = neighborhoods.to_crs(26986)

# Simplify the geometries of the neighborhoods using a tolerance of 2 meters.
# This will reduce the number of vertices in each geometry, which will reduce
# the file size.
neighborhoods['geometry'] = neighborhoods.simplify(2)

# Convert back to 4326 and save the simplified neighborhoods to a new geojson
# file.
neighborhoods = neighborhoods.to_crs(4326)
neighborhoods.to_file(DATA_DIR / 'City_of_Boston_Boundary_Simplified.geojson', driver='GeoJSON')
