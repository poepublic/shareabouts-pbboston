## Why

We need a secure and anonymous voter authentication system for the Participatory Budgeting voting application. It must support generating and verifying login codes via SMS, accommodate admins generating manual codes, and persist session states across stateless Cloud Run instances to prevent double voting.

## What Changes

- Implement a Twilio integration to send 6-digit hexadecimal login codes via SMS to voters.
- Generate and store voter codes (hashed phone number, 30-min TTL) and admin codes (hashed UUID, 1-7 day TTL) in the Redis cache backend.
- Replace the test view with actual implementations of `generate_code` (voter and admin variations) and `verify_code` endpoints in `sa_vote/views.py`.
- Query the upstream Shareabouts API (`GET /datasets/<name>/ballots/?id_hash=<hash>`) using a privileged API key to prevent code generation for phone numbers that have already voted.

## Capabilities

### New Capabilities
- `voter-authentication`: Voter code generation (SMS/admin) and verification logic using Redis-backed caching and Twilio.

### Modified Capabilities

## Impact

- Modifies `src/sa_vote/views.py` and `src/sa_vote/urls.py` for new endpoints.
- Requires adding `twilio` to `app-requirements.txt` and defining new environment variables (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`).
- Requires configuring the Cloud Run service with a Serverless VPC Access connector to reach the private Redis instance.
