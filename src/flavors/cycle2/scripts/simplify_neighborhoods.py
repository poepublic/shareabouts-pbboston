import json
import pathlib


data_dir = pathlib.Path(__file__).parent.parent / 'static' / 'data'

source_file = data_dir / 'BPDA_Neighborhood_Boundaries.geojson'
dest_file = data_dir / 'neighborhoods.geojson'


def round_coords(coordinates):
    if isinstance(coordinates, list):
        return [round_coords(c) for c in coordinates]
    else:
        return round(coordinates, 6)


with open(source_file, 'r') as f:
    data = json.load(f)

    for feature in data['features']:
        # Only keep the 'name' property
        feature['properties'] = {'name': feature['properties']['name']}

        # Round all of the coordinates to no more than 6 decimal places
        feature['geometry']['coordinates'] = round_coords(feature['geometry']['coordinates'])

    with open(dest_file, 'w') as f:
        content = json.dumps(data)
        # Get rid of extra spaces after commas and colons
        content = content.replace(', ', ',').replace(': ', ':')
        f.write(content)
