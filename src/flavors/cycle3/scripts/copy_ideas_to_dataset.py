# Usage: python copy_ideas_to_dev.py <SRC_KEY> <DST_KEY>

import sys
import requests
from collections.abc import Iterator
from typing import TypedDict, cast
from copy import deepcopy

SRC_DATASET_ROOT = 'https://shareaboutsapi.poepublic.com/api/v2/pbboston/datasets/cycle2'
DST_DATASET_ROOT = 'https://shareaboutsapi.poepublic.com/api/v2/pbboston/datasets/cycle3-dev'


class CollectionMetadata(TypedDict):
    length: int
    next: str | None
    previous: str | None
    page: int
    num_pages: int


class Feature(TypedDict):
    id: int | str
    geometry: dict
    properties: dict
    type: str


class UnsavedFeature(TypedDict):
    geometry: dict
    properties: dict
    type: str

    
class FeatureCollection(TypedDict):
    features: list[Feature]
    type: str
    metadata: CollectionMetadata


def get_places(root: str, key: str | None = None) -> Iterator[Feature]:
    url = f'{root}/places'
    query = '?include_private&include_invisible' if key else ''
    headers = {'X-Shareabouts-Key': key} if key else {}
    next_page = f'{url}{query}'

    while next_page:
        print(f'Getting places from {next_page}')
        response = requests.get(next_page, headers=headers)
        response.raise_for_status()
        data = response.json()
        yield from data['features']
        next_page = data['metadata']['next']


def create_place(root: str, key: str, feature: UnsavedFeature) -> Feature:
    url = f'{root}/places'
    headers = {'X-Shareabouts-Key': key}
    response = requests.post(url, json=feature, headers=headers)
    try:
        response.raise_for_status()
    except Exception:
        print(f'Failed to create place: {feature}')
        print(f'Response: {response.text}')
        raise
    return response.json()


def copy_dataset_to_dev(src_key, dst_key, skip=0):
    print(f'Copying data from {SRC_DATASET_ROOT} to {DST_DATASET_ROOT}')

    place_id_map: dict[int | str, int | str] = {}

    for count, feature in enumerate(get_places(SRC_DATASET_ROOT, src_key)):
        # If data was loaded already, skip however many records were already loaded
        if count < skip:
            continue

        draft_feature: UnsavedFeature = {
            'geometry': deepcopy(feature['geometry']),
            'properties': deepcopy(feature['properties']),
            'type': feature['type'],
        }

        draft_feature['properties']['submitter'] = None

        # Reposition city-wide projects to be at City Hall
        if draft_feature['properties']['city_wide'] in ('true', True):
            draft_feature['geometry']['coordinates'] = [-71.058068, 42.360556]

        new_feature = create_place(DST_DATASET_ROOT, dst_key, draft_feature)
        place_id_map[feature['id']] = new_feature['id']


if __name__ == '__main__':
    src_key = sys.argv[1]
    dst_key = sys.argv[2]
    skip = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    copy_dataset_to_dev(src_key, dst_key, skip=skip)
