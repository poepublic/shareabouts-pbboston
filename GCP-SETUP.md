I'm setting up a Shareabouts client on GCP. Instructions for building/pushing an image are https://cloud.google.com/build/docs/build-push-docker-image.

```bash
export PROJECT=poepublic-shareabouts
export REGION=us-central1
export REPO=shareabouts-pbboston

# Create a repository
gcloud artifacts repositories create ${REPO} --repository-format=docker \
    --location=${REGION} --description="Shareabouts client for PB Boston"

# Build an image
gcloud builds submit --region=${REGION} --tag ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/prod:latest
```

Though the easiest way might be: https://cloud.google.com/run/docs/continuous-deployment-with-cloud-build. That will set up the build automatically (look in the "global" region for the triggers). You'll have to edit the environment variables in the Dockerfile to ensure that the correct Shareabouts flavor package is being used (for compiling assets and such).

```dockerfile
ARG SHAREABOUTS_FLAVOR=cycle1
```

Set the environment variables on the Run services like:

```bash
# Set env vars
gcloud run services update shareabouts-pbboston-staging --env-vars-file=<(cat .env.cycle1.staging | python3 env2yml.py)

# View vars
gcloud run services describe shareabouts-pbboston-staging
```

### VPC Access for Cloud Run (Cross-Region Redis via Direct VPC Egress)

The PB Boston Cloud Run service runs in **`us-east4`** (Northern Virginia) to maintain compatibility with the City of Boston's Web Application Firewall (WAF) IP allowlisting. However, the Shareabouts API backend, database, and Memorystore Redis server reside in **`us-central1`** (Iowa) within a private VPC network (`<service_name>-vpc`).

Because Serverless VPC Access connectors are strictly regional resources, an `us-east4` Cloud Run service **cannot** attach to an `us-central1` VPC connector. Instead, configure Cloud Run **Direct VPC Egress** (`--network` and `--subnet`), routing traffic over Google's global private network to the remote Redis instance without connector overhead.

#### 1. VPC Networking Prerequisites

Before attaching the Cloud Run service, verify two VPC configurations:

##### A. Ensure a Subnet Exists in `us-east4`
Direct VPC Egress requires a subnetwork in the *same region* as the Cloud Run service (`us-east4`). Check if your VPC has an `us-east4` subnet:

```bash
export NETWORK_BASE_NAME="<service-name>" # e.g. shareabouts-api

gcloud compute networks subnets list \
    --network=${NETWORK_BASE_NAME}-vpc \
    --filter="region:us-east4"
```

If no subnet exists in `us-east4` (e.g. if the VPC was created with `auto_create_subnetworks = false`), create one:
```bash
gcloud compute networks subnets create "${NETWORK_BASE_NAME}-subnet-useast4" \
    --network=${NETWORK_BASE_NAME}-vpc \
    --region=us-east4 \
    --range="10.1.0.0/24"
```

##### B. Enable Global Dynamic Routing on the VPC Network
For traffic originating in `us-east4` to reach Memorystore Redis and peered services in `us-central1`, the VPC routing mode must be set to `GLOBAL`:

```bash
# Check current routing mode (REGIONAL vs GLOBAL)
gcloud compute networks describe ${NETWORK_BASE_NAME}-vpc --format="value(routingConfig.routingMode)"

# If REGIONAL, update to GLOBAL
gcloud compute networks update ${NETWORK_BASE_NAME}-vpc --bgp-routing-mode=GLOBAL
```

#### 2. Attach Direct VPC Egress to Cloud Run

Update your Cloud Run service using `gcloud run services update`:

```bash
export PB_SERVICE_NAME="shareabouts-pbboston-cycle3-staging" # or production service name
export REGION="us-east4"
export VPC_SUBNET="<subnet-name-in-us-east4>"

gcloud run services update ${PB_SERVICE_NAME} \
    --region=${REGION} \
    --network=${NETWORK_BASE_NAME}-vpc \
    --subnet=${VPC_SUBNET} \
    --vpc-egress=private-ranges-only
```

> [!IMPORTANT]
> **Keep `--vpc-egress=private-ranges-only`:**
> `private-ranges-only` routes private RFC 1918 traffic (such as Redis) through the VPC, while allowing outbound calls to external public APIs (Google Cloud Translation API, GitHub App REST API, and Twilio SMS) to exit directly to the internet without requiring a Cloud NAT gateway.

#### 3. Cross-Region Latency Mitigation & Environment Configuration

Cross-region round trips between `us-east4` and `us-central1` take ~20–35ms per Redis call. If Django's default `cache` session backend is used, this latency is incurred on every HTTP request (2–4 sequential round trips = ~100ms added to every page load).

To prevent this latency penalty, configure session storage to use **signed cookies**, reserving Redis strictly for low-frequency SMS voter code mapping and IP rate limiting:

1. Obtain the Redis host and port from your Terraform outputs in `../shareabouts-api/infra/gcp/envs/prod/` (or `common`):
   ```bash
   cd ../shareabouts-api/infra/gcp/envs/prod
   terraform output redis_host
   terraform output redis_port
   ```

2. Set the following environment variables in your environment configuration (`.env.cycle3.*` or Cloud Run service env vars):
   ```bash
   # Connect to the private Redis instance in us-central1
   REDIS_URL=redis://<redis_host>:<redis_port>/0

   # Use signed cookies to eliminate cross-region Redis round trips on standard HTTP requests
   SESSION_ENGINE=django.contrib.sessions.backends.signed_cookies
   ```

3. Update the service environment variables:
   ```bash
   gcloud run services update ${PB_SERVICE_NAME} \
       --region=${REGION} \
       --update-env-vars="REDIS_URL=redis://<redis_host>:<redis_port>/0,SESSION_ENGINE=django.contrib.sessions.backends.signed_cookies"
   ```

#### 4. Service-Level Configuration Persistence & CI/CD

Cloud Run service configurations are declarative and persistent across revisions:
- Settings configured via `gcloud run services update` (such as `--network`, `--subnet`, `--vpc-egress`, and environment variables) are **automatically retained** on subsequent deployments.
- When `cloudbuild.yaml` executes `gcloud run deploy ... --image ...`, Cloud Run updates only the container image, leaving your Direct VPC egress and environment settings intact.
- **Do NOT add `--network`, `--subnet`, or `--vpc-egress` flags to `cloudbuild.yaml`**. Keeping infrastructure networking decoupled from the build file ensures build triggers remain clean and portable across environments.


### Google Cloud Translation API Configuration

The ballot proposal WYSIWYG editor uses Google Cloud Translation API to provide first-pass automated translations for Boston's threshold languages (Spanish, Haitian Creole, Simplified Chinese, Brazilian Portuguese, Arabic, Somali, Vietnamese).

#### 1. Enable Cloud Translation API on GCP
```bash
gcloud services enable translate.googleapis.com --project=${PROJECT}
```

#### 2. Service Account Permissions (Cloud Run Production & Staging)
When running on Cloud Run, the application uses **Application Default Credentials (ADC)**. It does not require any API keys or credentials stored in environment variables.

Find the runtime service account used by your Cloud Run service (or default compute service account):
```bash
# Get the service account email of the Cloud Run service
gcloud run services describe shareabouts-pbboston-staging \
    --region=${REGION} \
    --format="value(spec.template.spec.serviceAccountName)"
```

Grant the **Cloud Translation API User** role (`roles/cloudtranslate.user`) to that service account:
```bash
export SERVICE_ACCOUNT="<service-account-email>"

gcloud projects add-iam-policy-binding ${PROJECT} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/cloudtranslate.user"
```

#### 3. Local Development Configuration
In local development, the application automatically uses your local Google Cloud CLI credentials via Application Default Credentials:
```bash
gcloud auth application-default login
```
Set `GOOGLE_TRANSLATE_PROJECT_ID` in your `.env` file, e.g.:
```bash
GOOGLE_TRANSLATE_PROJECT_ID=poepublic-shareabouts
```

#### 4. Non-GCP Hosting Environments (e.g. Heroku, standalone VPS, or API key fallback)
If running outside of GCP where Application Default Credentials / service accounts are not available:
1. In Google Cloud Console, navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > API key**.
3. (Recommended) Restrict the key to only allow calls to **Cloud Translation API**.
4. Set the key in your environment variables:
   ```bash
   GOOGLE_TRANSLATE_API_KEY=AIzaSy...
   ```

