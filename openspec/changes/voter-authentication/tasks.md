## 1. Environment & Setup

- [ ] 1.1 Add `twilio` to `app-requirements.txt`.
- [ ] 1.2 Read `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` environment variables in `src/project/settings.py`.

## 2. Authentication Logic

- [ ] 2.1 Implement `/vote/generate-code` view to handle voter requests, including Shareabouts API duplicate check, code generation, caching, and SMS sending.
- [ ] 2.2 Implement `/admin/generate-code` view for admins to generate codes backed by a UUID hash, stored with a 7-day TTL.
- [ ] 2.3 Implement `/vote/verify-code` view to validate codes against the cache and set the user's session state.
- [ ] 2.4 Wire up the new views in `src/sa_vote/urls.py`.

## 3. Testing

- [ ] 3.1 Write tests for `/vote/generate-code` verifying successful generation, SMS dispatch, and rejection if a ballot exists.
- [ ] 3.2 Write tests for `/admin/generate-code` verifying admin access requirements and long TTL code caching.
- [ ] 3.3 Write tests for `/vote/verify-code` verifying session state mutation upon successful login, and 404 behavior for invalid codes.
