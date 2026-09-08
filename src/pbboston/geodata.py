import json
import pathlib

DATA_DIR = pathlib.Path(__file__).parent / 'static' / 'data'


def load_neighborhoods():
    with open(DATA_DIR / 'Boston_Neighborhood_Boundaries_Simplified.geojson') as f:
        return json.load(f)


def load_city():
    with open(DATA_DIR / 'City_of_Boston_Boundary_Simplified.geojson') as f:
        return json.load(f)
