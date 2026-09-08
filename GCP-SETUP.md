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
