# GitHub Integration Setup Guide

This guide describes how to configure the GitHub App and environment variables required for the Git-backed Ballot Content Management service in the PB Boston application.

---

## 1. Overview

The Ballot Content Manager enables staff administrators to edit and translate ballot proposals directly from the admin interface. All modifications (Markdown descriptions, YAML metadata, and uploaded images) are saved directly back to the GitHub repository using the GitHub Trees & Commits API via a shared GitHub App, without requiring personal GitHub accounts for individual staff members.

---

## 2. Create the GitHub App

1. Log in to GitHub and navigate to the developer settings for the organization (or account) owning the repository:
   - **Organization**: Go to **Settings > Developer Settings > GitHub Apps > New GitHub App** (e.g., `https://github.com/organizations/poepublic/settings/apps/new`).
   - **Personal Account**: Go to **Settings > Developer Settings > GitHub Apps > New GitHub App** (e.g., `https://github.com/settings/apps/new`).

2. **Basic Information**:
   - **GitHub App name**: e.g., `Shareabouts PB Boston Content Manager` (must be unique across GitHub).
   - **Homepage URL**: `https://github.com/poepublic/shareabouts-pbboston`
   - **Webhook**: Uncheck **Active** (the application only makes outbound API calls).

3. **Repository Permissions**:
   Under **Repository permissions**, configure the following:
   - **Contents**: Set to **Read and write** (needed to read git trees/blobs and author new commits/branches).
   - *(**Metadata**: Will automatically be set to **Read-only**).*

4. **Installation Scope**:
   - Under **Where can this GitHub App be installed?**, select **Only on this account**.
   - Click **Create GitHub App**.

---

## 3. Generate Private Key and Install the App

1. On the app settings page, note the **App ID** (displayed at the top in General settings).
2. Scroll down to **Private keys** and click **Generate a private key**. A `.pem` file will download automatically.
3. Place this `.pem` file in a secure location on your server or development environment. In this repository, the `keys/` directory is gitignored for local development:
   ```bash
   mkdir -p keys
   mv ~/Downloads/your-app-private-key.pem keys/pb-boston-ballot-content-manager.private-key.pem
   chmod 600 keys/*.pem
   ```
4. In the left navigation of the app settings, click **Install App**.
5. Click **Install** next to the target organization (`poepublic`).
6. Choose **Only select repositories** and select `shareabouts-pbboston`.
7. Once installed, note the **Installation ID** from the URL (e.g. `https://github.com/organizations/poepublic/settings/installations/<INSTALLATION_ID>`).

---

## 4. Environment Variables Reference

Add the following variables to your environment file (`.env`, `.env.cycle3.local`, GCP Secret Manager, or Cloud Run configuration):

```bash
# GitHub App Authentication
GITHUB_APP_ID=5087842
GITHUB_APP_INSTALLATION_ID=165214410
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/keys/pb-boston-ballot-content-manager.private-key.pem

# Alternatively, pass the private key directly via environment variable:
# 1. Base64-encoded string (recommended for single-line .env files):
#    GITHUB_APP_PRIVATE_KEY="<base64_encoded_pem>"
# 2. Escaped string:
#    GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"

# Target Repository and Branch
GITHUB_REPO=poepublic/shareabouts-pbboston
GITHUB_BRANCH=main
# (or ballot-content-test for testing)

# Optional fallback: Personal Access Token (for development / debugging)
# GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 5. Deploying to Google Cloud Platform (GCP)

When deploying to Google Cloud (Cloud Run), **do not** include your private key file in the container build. Instead, store the private key in **Google Secret Manager**.

### Step 1: Create the Secret in Secret Manager

```bash
# Create the secret from your local .pem file
gcloud secrets create shareabouts-pbboston-github-app-key \
    --data-file=keys/pb-boston-ballot-content-manager.private-key.pem \
    --replication-policy="automatic"
```

### Step 2: Configure Cloud Run

You have two recommended options for attaching the secret to your Cloud Run service:

#### Option A: Mount Secret as a File (Recommended)

Cloud Run allows mounting secrets directly as a file inside the container filesystem. This avoids storing private keys in environment variables and avoids newline parsing issues with `.env` conversion scripts.

1. Mount the secret volume when deploying or updating the Cloud Run service:
   ```bash
   gcloud run services update <service-name> \
       --set-secrets /secrets/github-app-key.pem=shareabouts-pbboston-github-app-key:latest \
       --region <region>
   ```

2. In your `.env` (or via `env2yml.py`), set the file path:
   ```bash
   GITHUB_APP_PRIVATE_KEY_PATH=/secrets/github-app-key.pem
   ```

#### Option B: Inject as Environment Variable via Secret Manager

If you prefer using an environment variable without mounting a volume, inject the secret directly into `GITHUB_APP_PRIVATE_KEY` using Cloud Run's secret integration:

```bash
gcloud run services update <service-name> \
    --set-secrets GITHUB_APP_PRIVATE_KEY=shareabouts-pbboston-github-app-key:latest \
    --region <region>
```

> **Note on `.env` files & `env2yml.py`**:
> If you are passing environment variables through `.env` files using `env2yml.py` or `env2googlesecrets.py`, multiline PEM content cannot be pasted directly because those scripts split each line by `=`. Instead, encode the `.pem` file as a single-line Base64 string:
> ```bash
> base64 -w 0 keys/pb-boston-ballot-content-manager.private-key.pem
> ```
> And place that single line in `.env`:
> ```bash
> GITHUB_APP_PRIVATE_KEY=<base64_encoded_string>
> ```
> `GitHubContentManager` automatically detects and decodes Base64 strings.

---

## 6. Flavor Configuration (`config.yml`)

The admin content manager restricts editing to authorized ballot managers. In your flavor's configuration file (e.g. `src/flavors/cycle3/config.yml`), ensure the manager group is configured under `ballot`:

```yaml
ballot:
  voter_support_group: admin
  manager_group: admin
  max_selections: 5
```

Users with this group assigned in Shareabouts API (or Django superusers/staff) are permitted to read and commit proposal updates.

---

## 7. Verifying the Setup

### Running Unit Tests

Running the Django tests requires three components:
1. **Environment Variables**: Django requires your project settings and credentials (such as `SHAREABOUTS_FLAVOR`, `SECRET_KEY`, and the `GITHUB_*` variables) loaded in the environment.
2. **Project Virtual Environment**: The Python environment where project requirements (including `pygithub` and `django`) are installed.
3. **Django Test Runner**: The `manage.py test sa_admin` command.

Depending on how you manage your local virtual environment and environment files:

**Option A: Virtual environment activated and using `dotenv-cli`:**
```bash
source <path-to-venv>/bin/activate
dotenv -e <path-to-env-file> python src/manage.py test sa_admin
```

**Option B: Directly invoking virtual environment python:**
```bash
dotenv -e <path-to-env-file> <path-to-venv>/bin/python src/manage.py test sa_admin
```

**Option C: Standard shell exports (without `dotenv-cli`):**
```bash
source <path-to-venv>/bin/activate
set -a && source <path-to-env-file> && set +a
python src/manage.py test sa_admin
```

---

### Verifying Live GitHub Communication

To test fetching live proposals from GitHub using the Django interactive shell:

```bash
# Launch Django shell with environment loaded
dotenv -e <path-to-env-file> python src/manage.py shell
```

Then run:

```python
from sa_admin.github import GitHubContentManager

mgr = GitHubContentManager()
print("Connected to branch:", mgr.branch)
state = mgr.get_ballot_state()
print(f"Loaded {len(state['proposals'])} proposals from GitHub.")
```
