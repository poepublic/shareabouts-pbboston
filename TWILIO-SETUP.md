# Twilio Setup Guide

This guide describes how to configure Twilio for SMS verification in the PB Boston application.

---

## 1. Account SID

1. Log in to the [Twilio Console](https://console.twilio.com/).
2. On the **Console Dashboard** (or under **Builder tools > API Key & creds > Auth tokens**), locate your **Account SID** (starts with `AC...`).
3. Save this value as `TWILIO_ACCOUNT_SID`.

---

## 2. Phone Number

The application requires an SMS-enabled Twilio phone number to send verification codes.

1. Navigate to **Phone Numbers > Manage > Active numbers** (or **Buy a number** if one has not been purchased).
2. Ensure the phone number has **SMS** capability enabled.
3. Note the number in [E.164 format](https://www.twilio.com/docs/glossary/what-e164) (e.g., `+16175551234`).
4. Save this value as `TWILIO_PHONE_NUMBER`.

> [!NOTE]
> For US messaging, ensure your Twilio account is registered with an A2P 10DLC campaign or toll-free verification to prevent carrier message blocking.

---

## 3. Create an API Key

Twilio recommends using **API Keys** instead of the master **Auth Token** to adhere to the principle of least privilege and allow easy key rotation without exposing your primary account credentials.

1. Navigate to **Builder tools > API Key & creds > API Keys** (or go to **Account > API keys & tokens**).
2. Click **Create API Key**.
3. Fill out the creation form:
   - **Friendly name**: e.g., `pb-boston-sms-prod` (or `pb-boston-sms-staging`).
   - **Key type**:
     - **Restricted Key** (*Recommended*): Under the permissions table, expand **Messaging > Messages**:
       - On the **`messages`** row, check **`Create`** (required for `client.messages.create(...)` to send outbound SMS) and optionally **`Read`** (to fetch individual message status by SID).
       - Leave **`List`**, **`Update`**, and **`Delete`** unchecked (this prevents the key from browsing past message history or modifying records).
       - Leave all other products unchecked (no permissions needed for `feedback`, `media`, `voice`, `billing`, etc.).
     - **Standard Key**: Provides broad account-wide API access (excluding credential management).
4. Click **Create API Key**.
5. Twilio will display the key details:
   - **SID**: Starts with `SK...`. Save this as `TWILIO_API_KEY`.
   - **Secret**: A secure string. Save this as `TWILIO_API_SECRET`.

> [!IMPORTANT]
> The API Key **Secret** is displayed only once upon creation. Copy and store it securely immediately.

---

## 4. Environment Variables Reference

Add the following variables to your environment (`.env`, GCP Secret Manager, or Cloud Run service configuration):

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_key_secret_here
TWILIO_PHONE_NUMBER=+16175551234
```

### Syncing to GCP (Staging / Production)

If deploying to Google Cloud Platform using this project's tooling:

1. Add the variables to your environment file (e.g. `.env.cycle1.prod`).
2. Sync secrets to GCP Secret Manager:
   ```bash
   cat .env.cycle1.prod | python3 env2googlesecrets.py [PROJECT_ID] [SECRET_NAME_PREFIX]
   ```
   Or update the Cloud Run service environment variables:
   ```bash
   gcloud run services update shareabouts-pbboston-prod \
       --env-vars-file=<(cat .env.cycle1.prod | python3 env2yml.py)
   ```
