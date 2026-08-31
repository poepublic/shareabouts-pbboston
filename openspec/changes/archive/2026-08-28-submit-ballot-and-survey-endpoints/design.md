## Context

See `proposal.md` for motivation. The `sa_vote` Django app manages the voting interface and voter verification sessions (`voter_verified`, `voter_id_hash`). Voting in PB Boston consists of submitting a ballot with 1–5 proposal choices followed by an optional demographic survey. The upstream Shareabouts API requires write operations to be associated with a specific place entity (the "ballot box") authenticated with a dedicated API key possessing write permissions for submission sets.

## Goals / Non-Goals

**Goals:**
- Provide `/vote/api/submit-ballot` to validate proposal selections, perform upstream duplicate checking, and persist anonymous ballot records.
- Provide `/vote/api/submit-survey` to perform duplicate checking, transform survey payload keys to `anonymous_<key>`, persist survey records, and clear voter session verification.
- Enforce session-based authentication using `voter_verified` and `voter_id_hash`.
- Validate proposal slugs against the active cycle's ballot proposal definitions via `Ballot.from_config`.
- Enhance `ShareaboutsApi` to manage `api_key` headers, provide JSON-returning `get()`, and add `create()` with `silent` support.
- Configure dedicated `SHAREABOUTS_BALLOTBOX_ID` and `SHAREABOUTS_BALLOTBOX_KEY` settings.

**Non-Goals:**
- Distributed locking in Redis for concurrency edge cases (relying on upstream duplicate check for MVP).
- Frontend UI components for ballot selection and survey rendering (covered in separate issues #167 and #168).
- Admin reporting or CSV export of submitted ballots (covered in epic #157).

## Decisions

### Decision 1: Session state verification and attribute naming
- **Choice**: Read `request.session.get('voter_verified')` and `request.session.get('voter_id_hash')` directly to match existing verification decorators and endpoints in `sa_vote/views.py`. Strip the `voter_` prefix when constructing the payload for the Shareabouts API (`"id_hash": voter_id_hash`).
- **Rationale**: Keeps session management consistent across `#153`, `#180`, and `#162`.
- **Alternatives Considered**: Dual-lookup supporting both `id_hash` and `voter_id_hash`, rejected to keep session semantics explicit.

### Decision 2: ShareaboutsApi Client Extensions & Place-Level Submissions
- **Choice**: Extend `ShareaboutsApi` in `src/sa_util/api.py` rather than making raw `requests` calls in views:
  - **API Key Management**: `ShareaboutsApi.__init__` accepts `api_key: str | None = None` (defaulting to `settings.SHAREABOUTS.get('DATASET_KEY')`) and attaches `X-Shareabouts-Key` to `self.session.headers`.
  - **`api.get(resource, default=None, **kwargs)`**: Updated to return `res.json()` on 200, `None` on 404, and call `res.raise_for_status()` on any other status.
  - **`api.create(resource, json=None, data=None, silent=False, **kwargs)`**: POSTs to the resource under `dataset_root`, passing `X-Shareabouts-Silent: true` when `silent=True`.
  - Views use `api.get(f'{submission_type}/', id_hash=voter_id_hash)` for duplicate checking and `api.create(f'places/{ballotbox_id}/{submission_type}/', json=payload)` for submissions.

### Decision 3: Client request formats and server-side payload transformation
- **Choice**:
  - `submit-ballot` expects JSON: `{"proposals": ["slug1", "slug2", ...]}`. Transformed for API to:
    ```json
    {
      "id_hash": "<voter_id_hash>",
      "lang": "<lang>",
      "anonymous_proposals": ["slug1", "slug2"]
    }
    ```
  - `submit-survey` expects JSON: `{"age": 25, "neighborhood": "Dorchester", ...}`. Transformed for API to:
    ```json
    {
      "id_hash": "<voter_id_hash>",
      "lang": "<lang>",
      "anonymous_age": 25,
      "anonymous_neighborhood": "Dorchester"
    }
    ```
- **Rationale**: Clean separation between voter UI model and API storage schema. Automatically prefixing `anonymous_` keeps frontend code free from upstream data structure nuances.
- **Alternatives Considered**: Requiring frontend to supply `anonymous_` keys directly (rejected to avoid leaking backend schema conventions to UI).

### Decision 4: Two-stage session lifecycle
- **Choice**: Ballot submission leaves `voter_verified=True` and `voter_id_hash` intact on the session so the voter can proceed seamlessly to the post-voting survey view. Survey submission successfully clears both session attributes. If a voter abandons the survey, session expiration and the upstream duplicate check prevent replay.
- **Rationale**: Provides smooth UX between voting and survey without requiring ephemeral handoff tokens.
- **Alternatives Considered**: Immediately clearing verification upon ballot submission and issuing a signed JWT/token for survey (unnecessary complexity for an optional survey).

### Decision 5: Ballot Loading from Config & View-Level Slug Validation
- **Choice**: Add `Ballot.from_config(config: ShareaboutsLocalConfig, lang=DEFAULT_LANG, fallback_langs=None)` to `src/sa_vote/ballots.py`, resolving `config.path` and `config.get('ballot', {}).get('proposals_folder', 'ballot')`. Expose a `slugs` property (`set[str]`). The `submit_ballot` view uses `@process_shareabouts_config` to access `request.shareabouts_config`, instantiate `Ballot.from_config`, and validate proposal selection count (1–5) and slug membership against `ballot.slugs`.

## Risks / Trade-offs

- **[Concurrent double-submission]** → *Risk*: A voter sending simultaneous ballot requests could bypass the read-then-write duplicate check. *Mitigation*: Accepted for MVP; upstream unique constraints or future Redis locking can be layered on if necessary.
- **[Missing environment configuration]** → *Risk*: Deployment without `SHAREABOUTS_BALLOTBOX_ID` or `SHAREABOUTS_BALLOTBOX_KEY` causes unexpected 500 errors. *Mitigation*: Check settings at startup or request time with clear logging when unconfigured.
- **[Language extraction]** → *Risk*: Submitted `lang` doesn't match active voter language. *Mitigation*: Use Django's `translation.get_language()` or fallback to `'en'`.

## Migration Plan

1. Define `SHAREABOUTS_BALLOTBOX_ID` and `SHAREABOUTS_BALLOTBOX_KEY` in environment config files (`.env.cycle3.*`).
2. Deploy backend changes to staging environment and verify end-to-end submissions against staging Shareabouts API dataset and ballot box place.
