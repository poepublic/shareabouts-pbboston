# Ballot and Survey Submission API

## Purpose

Provides backend API endpoints for voters to submit ballots and demographic surveys during PB Boston voting, enforcing session verification, duplicate prevention, and privacy-preserving data isolation.

## Requirements

### Requirement: Submit Ballot Endpoint Authenticates Verified Voter Session
The `/vote/api/submit-ballot` endpoint SHALL require an active Django session with `voter_verified=True` and a non-empty `voter_id_hash`. If either condition is not met, the system SHALL return an HTTP `403 Forbidden` response.

#### Scenario: Unverified session rejected for ballot submission
- **WHEN** a client sends a POST request to `/vote/api/submit-ballot` without `voter_verified=True` or `voter_id_hash` in their session
- **THEN** the system SHALL return HTTP `403 Forbidden` with an error message indicating the session is unverified

#### Scenario: Verified session accepted for ballot submission
- **WHEN** a client with `voter_verified=True` and a valid `voter_id_hash` in their session sends a POST request to `/vote/api/submit-ballot`
- **THEN** the system SHALL proceed with validation and submission processing

### Requirement: Submit Ballot Validates Proposal Selections
The `/vote/api/submit-ballot` endpoint SHALL validate that the request body is a JSON object containing a `proposals` array with between 1 and 5 unique proposal slugs, and that all specified slugs exist in the active cycle's ballot proposal definitions. If validation fails, the system SHALL return an HTTP `400 Bad Request` response.

#### Scenario: Empty proposal list submitted
- **WHEN** a client sends a ballot payload containing `{"proposals": []}`
- **THEN** the system SHALL return HTTP `400 Bad Request` indicating at least one proposal must be selected

#### Scenario: More than five proposals submitted
- **WHEN** a client sends a ballot payload containing more than 5 proposal slugs
- **THEN** the system SHALL return HTTP `400 Bad Request` indicating at most 5 proposals may be selected

#### Scenario: Invalid proposal slug submitted
- **WHEN** a client sends a ballot payload containing a proposal slug that does not exist in the active flavor's ballot content
- **THEN** the system SHALL return HTTP `400 Bad Request` indicating the invalid proposal slug

#### Scenario: Valid proposal selection submitted
- **WHEN** a client sends a ballot payload containing between 1 and 5 valid proposal slugs
- **THEN** the system SHALL accept the proposal list and proceed to duplicate checking

### Requirement: Submit Ballot Enforces Single Ballot per Voter
The system SHALL query the upstream Shareabouts API dataset at `GET /{dataset_root}/ballots/?id_hash={id_hash}` prior to creating a ballot. If one or more matching ballot records exist, the system SHALL reject the submission with an HTTP `409 Conflict` response.

#### Scenario: First ballot submission succeeds duplicate check
- **WHEN** a verified voter submits a ballot and the upstream API returns zero results for their `id_hash`
- **THEN** the system SHALL proceed to persist the ballot

#### Scenario: Duplicate ballot submission rejected
- **WHEN** a verified voter submits a ballot and the upstream API returns an existing ballot result for their `id_hash`
- **THEN** the system SHALL return HTTP `409 Conflict` indicating a ballot has already been submitted for this voter

### Requirement: Submit Ballot Persists Anonymous Ballot to Ballot Box Place
Upon successful validation and duplicate verification, the system SHALL submit a POST request to `{dataset_root}/places/{SHAREABOUTS_BALLOTBOX_ID}/ballots/` using the authentication header `X-Shareabouts-Key: {SHAREABOUTS_BALLOTBOX_KEY}`. The payload SHALL contain `id_hash`, `lang` (current language code), and `anonymous_proposals` (list of selected proposal slugs). Upon successful upstream response, the endpoint SHALL return HTTP `201 Created` and retain the session verification state for subsequent survey submission.

#### Scenario: Successful ballot persistence
- **WHEN** a valid ballot is submitted and accepted upstream
- **THEN** the system SHALL return HTTP `201 Created` with a success status payload, leaving `voter_verified=True` in the session

#### Scenario: Upstream API failure during ballot persistence
- **WHEN** the upstream Shareabouts API returns an error or is unreachable during ballot persistence
- **THEN** the system SHALL return an appropriate HTTP `502 Bad Gateway` error response

### Requirement: Submit Survey Enforces Session Verification and Uniqueness
The `/vote/api/submit-survey` endpoint SHALL require an active Django session with `voter_verified=True` and a non-empty `voter_id_hash`. The system SHALL query `GET /{dataset_root}/surveys/?id_hash={id_hash}` and, if a survey record already exists, return an HTTP `409 Conflict` response.

#### Scenario: Unverified session rejected for survey submission
- **WHEN** a client sends a POST request to `/vote/api/submit-survey` without `voter_verified=True` or `voter_id_hash`
- **THEN** the system SHALL return HTTP `403 Forbidden`

#### Scenario: Duplicate survey submission rejected
- **WHEN** a verified voter submits a survey and the upstream API returns an existing survey result for their `id_hash`
- **THEN** the system SHALL return HTTP `409 Conflict`

### Requirement: Submit Survey Transforms Payload and Invalidates Voter Session
The `/vote/api/submit-survey` endpoint SHALL accept a JSON dictionary of survey responses, convert each response key to have the `anonymous_` prefix (e.g. `age` -> `anonymous_age`), include `id_hash` and `lang`, and submit the payload to `{dataset_root}/places/{SHAREABOUTS_BALLOTBOX_ID}/surveys/` using `X-Shareabouts-Key: {SHAREABOUTS_BALLOTBOX_KEY}`. Upon success, the endpoint SHALL invalidate the voter verification session by clearing `voter_verified` and `voter_id_hash`, and return HTTP `201 Created`.

#### Scenario: Successful survey submission and session invalidation
- **WHEN** a valid survey payload is submitted and successfully saved to the upstream API
- **THEN** the system SHALL clear `voter_verified` and `voter_id_hash` from the session and return HTTP `201 Created`

#### Scenario: Survey payload keys transformed to anonymous attributes
- **WHEN** client submits `{"age": 30, "neighborhood": "Dorchester"}`
- **THEN** the upstream payload sent to the API SHALL include `{"id_hash": "...", "lang": "...", "anonymous_age": 30, "anonymous_neighborhood": "Dorchester"}`
