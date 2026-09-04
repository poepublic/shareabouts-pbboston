## 1. Backbone Collection Extensions

- [x] 1.1 Update `SubmissionCollection.prototype.url` in `src/sa_web/static/js/models.js` to support dataset-level endpoint when `placeModel` is omitted
- [x] 1.2 Implement `Shareabouts.AnonymousCollection` extending `Shareabouts.PaginatedCollection` with dataset-level endpoint resolution
- [x] 1.3 Expose `.anonymous` sub-collection accessor on `SubmissionCollection` and `PlaceCollection`

## 2. Build & Verification

- [x] 2.1 Update automated test coverage in Jasmine for dataset-level submissions and anonymous collections
- [x] 2.2 Rebuild static assets with Grunt (`npx grunt`) and verify `src/sa_web/static/dist/app.js` is updated
- [x] 2.3 Verify against seed data in the `cycle3-vote-dev` dataset (confirm `/ballots`, `/ballots/anonymous`, and `/surveys/anonymous` paginate and parse properly); the `SHAREABOUTS_VOTE_DATASET_KEY` in `.env.cycle3.local` has `can_access_protected` status and can be used to test anonymous data access.
