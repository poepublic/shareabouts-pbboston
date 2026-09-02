## Context

This feature implements the authentication flows identified in the `voter-authentication` spec, ensuring stateless login across Cloud Run instances by relying on a Redis cache. See `proposal.md` for the overarching motivation.

## Goals / Non-Goals

**Goals:**
- Securely create, distribute, and verify authentication codes.
- Use Django's cache abstraction to support `django-redis` in production and `LocMemCache` in local development without code changes.
- Seamlessly query the upstream Shareabouts API to prevent code generation for phone numbers that have already voted.

**Non-Goals:**
- Handling rate limiting. IP-based rate limiting can be implemented later or handled at the infrastructure layer (e.g. Cloud Armor).
- Extensive automated end-to-end tests involving actual SMS delivery.

## Decisions

1. **Code Format:** Use 6-character hexadecimal codes generated securely via `os.urandom(3).hex()`. This yields ~16.7 million possible combinations, enough to deter guessing within a 30-minute window while remaining easy to type.
2. **Cache Storage:** We will rely on Django's built-in caching system (`django.core.cache.cache`) rather than a direct Redis client. This simplifies local development environments (where local memory cache is the default) while effortlessly scaling to Redis via the existing `django-redis` backend config in `settings.py`.
3. **Upstream API Queries:** We will utilize the refactored `ShareaboutsApi` client from the `178-ballot-survey-submission-endpoints` work. By instantiating it with the `SHAREABOUTS_BALLOTBOX_KEY`, we can query the `/ballots/?id_hash=<hash>` endpoint securely to prevent double voting.
4. **Twilio SMS:** We will introduce the `twilio` Python package for interacting with Twilio to send SMS messages, requiring standard Twilio environment variables.
5. **Voter Support Group Authorization:** Admin code generation is authorized against the authenticated Shareabouts API user's groups (`api.current_user()['groups']`). The required group name is specified in flavor configuration under `ballot.voter_support_group` (and can be overridden via the `SHAREABOUTS__BALLOT__VOTER_SUPPORT_GROUP` environment variable). The user must be a member of this group for the active dataset root (`group['dataset'] == api.dataset_root`).

## Risks / Trade-offs

- **Risk:** Upstream API latency could slow down code generation.
  **Mitigation:** The API query to `GET /ballots/?id_hash=<hash>` is indexed by `id_hash` and should be very fast.
- **Risk:** The PB Boston app on Cloud Run cannot reach the Redis instance.
  **Mitigation:** The Cloud Run instance will be deployed with the `--vpc-connector` flag to connect to the private VPC network where Redis resides.
