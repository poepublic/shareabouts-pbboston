## Why

Voters need secure backend endpoints to submit their chosen ballot proposals and optional demographic survey responses during the PB Boston voting period. The backend must enforce session-based voter eligibility, prevent duplicate voting and survey submissions against the upstream Shareabouts API, validate proposal selections against active cycle content, and cleanly isolate anonymous ballot and survey data sets.

## What Changes

- Add POST endpoint `/vote/api/submit-ballot` in `sa_vote` to validate voter session status, verify that no prior ballot exists in the upstream Shareabouts API for the voter's ID hash, and persist up to 5 proposal slugs as anonymous data to the configured ballot box place.
- Add POST endpoint `/vote/api/submit-survey` in `sa_vote` to validate voter session status, verify that no prior survey exists for the voter's ID hash, prefix incoming demographic survey keys with `anonymous_`, persist survey data to the configured ballot box place, and invalidate the voter verification state on the session.
- Add environment variables and configuration settings for `SHAREABOUTS_BALLOTBOX_ID` and `SHAREABOUTS_BALLOTBOX_KEY` to authenticate submissions to the designated ballot box place.
- Extend `ShareaboutsApi` in `src/sa_util/api.py` to support configurable `api_key` headers, update `api.get` to return parsed JSON (or None on 404), and add `api.create` supporting `silent` submissions via `X-Shareabouts-Silent`.
- Extend `Ballot` in `src/sa_vote/ballots.py` with `from_config(config: ShareaboutsLocalConfig)` and a `slugs` property, utilizing `@process_shareabouts_config` on views to avoid duplicate directory parsing.

## Capabilities

### New Capabilities
- `ballot-and-survey-submission-api`: Defines the endpoints, authentication/session verification rules, upstream duplicate checks, payload transformation, and submission flows for ballots and demographic surveys.

### Modified Capabilities
<!-- No existing capabilities modified -->

## Impact

- **Backend**: Adds submission handlers and routing in `src/sa_vote/views.py` and `src/sa_vote/urls.py`. Updates `ShareaboutsApi` in `src/sa_util/api.py`, `Ballot` in `src/sa_vote/ballots.py`, and place retrieval in `src/sa_web/views.py`.
- **Configuration**: Adds `SHAREABOUTS_BALLOTBOX_ID` and `SHAREABOUTS_BALLOTBOX_KEY` to `src/project/settings.py`.
- **Upstream API**: Interacts with Shareabouts API places endpoint (`/places/<BALLOTBOX_ID>/ballots/` and `/places/<BALLOTBOX_ID>/surveys/`) and dataset-level query endpoints (`/ballots/?id_hash=<hash>` and `/surveys/?id_hash=<hash>`).
- **Dependencies**: Uses existing Django session backend and `sa_util.api` utilities.
