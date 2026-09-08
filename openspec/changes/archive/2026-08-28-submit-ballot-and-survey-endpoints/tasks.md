## 1. Settings and Configuration Setup

- [x] 1.1 Add `SHAREABOUTS_BALLOTBOX_ID` and `SHAREABOUTS_BALLOTBOX_KEY` environment parsing in `src/project/settings.py`
- [x] 1.2 Update local environment template with ballot box configuration settings
- [x] 1.3 Extend `ShareaboutsApi` in `src/sa_util/api.py` with `api_key` constructor support, JSON-returning `get()`, and `create(..., silent=False)`
- [x] 1.4 Update existing `api.get` call site at `src/sa_web/views.py:184` to use updated `api.get`
- [x] 1.5 Add `Ballot.from_config(config)` and `slugs` property in `src/sa_vote/ballots.py`

## 2. Ballot Submission API Implementation

- [x] 2.1 Refactor `submit_ballot` in `src/sa_vote/views.py` to use `@process_shareabouts_config`, `Ballot.from_config`, and `ShareaboutsApi` (`api.get` and `api.create`)
- [x] 2.2 Register `/vote/api/submit-ballot` URL route in `src/sa_vote/urls.py`

## 3. Demographic Survey Submission API Implementation

- [x] 3.1 Refactor `submit_survey` in `src/sa_vote/views.py` to use `ShareaboutsApi` (`api.get` and `api.create`)
- [x] 3.2 Register `/vote/api/submit-survey` URL route in `src/sa_vote/urls.py`

## 4. Testing and Verification

- [x] 4.1 Update test suite in `src/sa_vote/tests.py` covering `/vote/api/submit-ballot` and `ShareaboutsApi` integration
- [x] 4.2 Update test suite in `src/sa_vote/tests.py` covering `/vote/api/submit-survey` and `ShareaboutsApi` integration
- [x] 4.3 Run test suite with `./src/manage.py test sa_vote` and ensure all tests pass
