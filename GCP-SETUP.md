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

### VPC Access for Cloud Run (Deployment Command)

To connect the PB Boston app to the Shareabouts API's Redis server (which lives in a private VPC network), you'll attach the Cloud Run service to the existing Serverless VPC Access connector that your API uses.

If you're deploying via gcloud, you'll use the --vpc-connector flag:

gcloud run deploy <pb-boston-service-name> \
    --image <your-image> \
    --vpc-connector <vpc_connector_id> \
    --region <region>

(You can get the exact <vpc_connector_id> from your Terraform outputs in ../shareabouts-api/infra/gcp/envs/prod/)

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

