## 1. Environment & Setup

- [x] 1.1 Add `twilio` to `app-requirements.txt`.
- [x] 1.2 Read `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` environment variables in `src/project/settings.py`.

## 2. Authentication Logic

- [x] 2.1 Implement `/vote/generate-code` view to handle voter requests, including Shareabouts API duplicate check, code generation, caching, and SMS sending.
- [x] 2.2 Implement `/admin/generate-code` view for users in the configured `voter_support_group` to generate codes backed by a UUID hash, stored with a 7-day TTL.
- [x] 2.3 Implement `/vote/verify-code` view to validate codes against the cache and set the user's session state.
- [x] 2.4 Wire up the new views in `src/sa_vote/urls.py`.

## 3. Testing

- [x] 3.1 Write tests for `/vote/generate-code` verifying successful generation, SMS dispatch, and rejection if a ballot exists.
- [x] 3.2 Write tests for `/admin/generate-code` verifying voter support group requirements (matching dataset vs other dataset / non-members) and long TTL code caching.
- [x] 3.3 Write tests for `/vote/verify-code` verifying session state mutation upon successful login, and 404 behavior for invalid codes.
