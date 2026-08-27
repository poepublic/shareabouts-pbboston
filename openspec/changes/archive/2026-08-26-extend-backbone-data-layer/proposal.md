## Why

The Shareabouts API recently added support for anonymous data ingestion and dedicated dataset-level submission endpoints (`/{submissionType}/` and `/{submissionType}/anonymous`). To build administrative voting and demographic reports (e.g. for Epic #157 / Issue #194), the client-side Backbone.js data layer in `sa_web` needs first-class support for fetching dataset-wide submissions and paginated anonymous value sets without requiring a specific `placeModel`.

## What Changes

- Allow `Shareabouts.SubmissionCollection` to be instantiated without a `placeModel`, resolving its endpoint to dataset-level `/{submissionType}/` rather than throwing an error.
- Introduce an `anonymous` property/sub-collection accessor on `Shareabouts.SubmissionCollection` and `Shareabouts.PlaceCollection` that queries dataset-level `/{submissionType}/anonymous` or `/places/anonymous`.
- Introduce `Shareabouts.AnonymousCollection` (extending `Shareabouts.PaginatedCollection`) tailored to parse anonymous data objects (`AnonymousValues` payload objects containing arbitrary survey/ballot blobs rather than full geojson/models).
- Ensure full backward compatibility with existing place-scoped `SubmissionCollection` workflows (e.g., `placeModel.submissionSets[...]`).

## Capabilities

### New Capabilities
- `backbone-anonymous-and-dataset-submissions`: Defines behavior for instantiating dataset-wide submission collections, accessing anonymous sub-collections, paginating over anonymous values, and handling anonymous data response structures.

### Modified Capabilities

## Impact

- `src/sa_web/static/js/models.js`: Updates `SubmissionCollection`, `PlaceCollection`, and adds `AnonymousCollection` or anonymous accessors.
- Bundled asset `src/sa_web/static/dist/app.js` via Grunt build.
- Consumer Vue apps in `sa_admin` and `sa_vote` will be able to construct collections for reporting dashboards and vote analytics.
