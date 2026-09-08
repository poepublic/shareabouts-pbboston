## Context

See `proposal.md` for motivation.

In `src/sa_web/static/js/models.js`, `Shareabouts.SubmissionCollection` currently enforces that a `placeModel` exists with a valid `id`:
```javascript
if (!placeId) {
  throw new Error('Place model id is not defined. You must save the place before saving its ' + submissionType + '.');
}
```
Furthermore, `PaginatedCollection` handles pagination (`fetchAllPages()`, `fetchNextPage()`, etc.) by reading `response.metadata` and extracting `response[this.resultsAttr]` (defaulting to `'results'`).

The Shareabouts API provides two key endpoints for anonymous vote data:
1. `GET {apiPrefix}/{submissionType}/` (e.g. `/ballots/`) - lists all submission records dataset-wide.
2. `GET {apiPrefix}/{submissionType}/anonymous` (e.g. `/ballots/anonymous`) - lists anonymous payload objects for that submission set.
3. `GET {apiPrefix}/places/anonymous` - lists anonymous place payloads.

Because anonymous data in the Shareabouts API is structurally decoupled from individual places and submissions (no foreign key to Place or Submission), anonymous collections are strictly dataset-level and do not support place-scoping.

## Goals / Non-Goals

**Goals:**
- Enable `SubmissionCollection` to fetch from dataset-level submission endpoints when `placeModel` is not specified.
- Provide a clean `collection.anonymous` property on `SubmissionCollection` and `PlaceCollection` that returns an `AnonymousCollection` configured with the proper dataset-level endpoint URL.
- Support `fetchAllPages()` and standard `PaginatedCollection` operations on `AnonymousCollection`.
- Maintain complete backward compatibility with existing place-scoped `SubmissionCollection` usages.

**Non-Goals:**
- Place-scoped anonymous collections (the API does not associate anonymous records with places).
- Implementing the reporting UI or Vue components (handled in subsequent issues).
- Modifying backend Django/API endpoints (API support already exists).
- Client-side data aggregation helpers (handled in Issue 4 / #196).

## Decisions

### 1. URL Resolution in `SubmissionCollection`
- **Choice**: Check if `placeModel` and `placeId` are present in `url()`. If present, construct `/places/<placeId>/<submissionType>`. If omitted, construct `/<submissionType>`. If `submissionType` is missing, throw an error.
- **Alternative considered**: Create a separate `DatasetSubmissionCollection`. Rejected because having a single `SubmissionCollection` that works at either scope is cleaner and matches standard Backbone collection idioms.

### 2. `Shareabouts.AnonymousCollection` Definition & URL Resolution
- **Choice**: Define `S.AnonymousCollection = S.PaginatedCollection.extend({ ... })` with `resultsAttr: 'results'` and dataset-level URL construction:
  - If `submissionType` is provided (e.g. `'ballots'`, `'surveys'`): `prefixApiEndpoint('/' + submissionType + '/anonymous')`
  - If `submissionType` is omitted (or `'places'`): `prefixApiEndpoint('/places/anonymous')`
- **Rationale**: Anonymous records in the API have no link to specific places or submissions, so URL resolution is strictly dataset-level.

### 3. Exposing `.anonymous` on Collections
- **Choice**: Initialize `this.anonymous = new S.AnonymousCollection([], { submissionType: this.options.submissionType })` inside `SubmissionCollection.prototype.initialize`, and `this.anonymous = new S.AnonymousCollection([], {})` inside `PlaceCollection.prototype.initialize`. `PlaceModel` does not have a place-scoped anonymous collection.
- **Rationale**: Enables intuitive syntax `const ballots = new Shareabouts.SubmissionCollection([], { submissionType: 'ballots' }); const anonBallots = ballots.anonymous; anonBallots.fetchAllPages();`.

## Risks / Trade-offs

- [Risk] Calling write methods (`save()`, `create()`) on `AnonymousCollection` could fail or have unexpected behavior since anonymous endpoints are read-only.
  → *Mitigation*: Document that `AnonymousCollection` is a read/query collection. (Backend API also responds with 405 Method Not Allowed if POST is attempted on anonymous endpoints).
- [Risk] Asset bundling mismatch if `models.js` is edited but `app.js` is not rebuilt.
  → *Mitigation*: Ensure Grunt build (`npm run postinstall` / `npx grunt`) is run and tested.
