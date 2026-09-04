# backbone-anonymous-and-dataset-submissions Specification

## Purpose

Defines client-side collection abstractions in the Backbone.js data layer for fetching dataset-wide submissions and paginated anonymous value sets from the Shareabouts API.

## Requirements

### Requirement: SubmissionCollection supports dataset-level URL resolution
The client data layer SHALL allow `SubmissionCollection` to be instantiated without an associated `placeModel`. When `placeModel` is omitted, the collection URL SHALL resolve to the dataset-level submission endpoint (`/{submissionType}`). When `placeModel` is provided, the collection URL SHALL continue to resolve to the place-specific submission endpoint (`/places/{placeId}/{submissionType}`).

#### Scenario: Instantiating SubmissionCollection without a placeModel
- **WHEN** a `SubmissionCollection` is instantiated with options containing `submissionType: 'ballots'` and no `placeModel`
- **THEN** evaluating its URL SHALL return the dataset-prefixed endpoint `/ballots` (e.g., `prefixApiEndpoint('/ballots')`)

#### Scenario: Instantiating SubmissionCollection with a placeModel
- **WHEN** a `SubmissionCollection` is instantiated with options containing `submissionType: 'ballots'` and a `placeModel` with `id: 123`
- **THEN** evaluating its URL SHALL return the place-specific endpoint `/places/123/ballots` (e.g., `prefixApiEndpoint('/places/123/ballots')`)

#### Scenario: Missing submissionType throws error
- **WHEN** a `SubmissionCollection` is instantiated without a `submissionType` option
- **THEN** an error SHALL be thrown indicating that `submissionType` is required

### Requirement: Collections provide access to dataset-level anonymous sub-collections
`SubmissionCollection` and `PlaceCollection` SHALL expose an `anonymous` property that returns an `AnonymousCollection` configured for the corresponding dataset-level anonymous endpoint (`/{submissionType}/anonymous` for submission sets and `/places/anonymous` for places). Because anonymous data instances in the Shareabouts API are structurally decoupled from individual places and submissions, anonymous collections SHALL NOT be scoped to individual places or submission instances.

#### Scenario: Accessing dataset-level anonymous sub-collection from SubmissionCollection
- **WHEN** the `anonymous` property of a `SubmissionCollection` for `submissionType: 'ballots'` is accessed
- **THEN** it SHALL return an `AnonymousCollection` whose URL resolves to the dataset-level anonymous endpoint `/ballots/anonymous` (e.g., `prefixApiEndpoint('/ballots/anonymous')`)

#### Scenario: Accessing place collection anonymous sub-collection
- **WHEN** the `anonymous` property of a `PlaceCollection` is accessed
- **THEN** it SHALL return an `AnonymousCollection` whose URL resolves to the dataset-level places anonymous endpoint `/places/anonymous` (e.g., `prefixApiEndpoint('/places/anonymous')`)

### Requirement: Anonymous collections fetch and paginate raw anonymous records
The `AnonymousCollection` SHALL extend pagination behavior such that calling `fetchAllPages()` or `fetchNextPage()` retrieves and accumulates all pages of anonymous records using the API pagination metadata.

#### Scenario: Fetching initial page of anonymous records
- **WHEN** `fetch()` is called on an `AnonymousCollection`
- **THEN** the collection SHALL parse `metadata` (length, page, num_pages, next) and populate its models from the response `results` array

#### Scenario: Fetching all pages of anonymous records
- **WHEN** `fetchAllPages()` is called on an `AnonymousCollection` with multiple pages of records
- **THEN** the collection SHALL sequentially or concurrently fetch all remaining pages and merge all records into the collection

### Requirement: Anonymous records parse payload dictionaries
The `AnonymousCollection` SHALL parse each element from the API `results` array as a model containing the anonymous key-value attributes (such as proposals arrays or survey responses).

#### Scenario: Parsing anonymous response objects
- **WHEN** the API returns an anonymous result item containing `{ proposals: ['p1', 'p2'] }`
- **THEN** the parsed model in `AnonymousCollection` SHALL have attribute `proposals` equal to `['p1', 'p2']` without requiring standard submission metadata (e.g. `id`, `submitter`, `created_datetime`)
