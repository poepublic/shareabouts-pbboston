#!/usr/bin/env python3

# Usage: cat .env | python3 env2googlesecrets.py [PROJECT_ID] [SECRET_NAME_PREFIX]

# The secret name prefix should be something in the form of "<client>-<service_role>-<env>".
# For example, "shareabouts-pbboston-cycle1-prod".

import sys
import re
from concurrent.futures import ThreadPoolExecutor
from google.cloud import secretmanager_v1

if len(sys.argv) != 3:
    print(
        "Usage: cat .env | python3 env2googlesecrets.py [PROJECT_ID] [SECRET_NAME_PREFIX]"
    )
    sys.exit(1)

project_id = sys.argv[1]
secret_name_prefix = sys.argv[2]

client = secretmanager_v1.SecretManagerServiceClient()


def get_existing_secret_names():
    request = secretmanager_v1.ListSecretsRequest(parent=f"projects/{project_id}")
    secrets = client.list_secrets(request=request)

    names = set()
    for secret in secrets:
        name = secret.name.split("/")[-1]
        names.add(name)

    return names


def sync_secret_value(name, value, force_new_version=False) -> tuple[str, str]:
    value = str(value)

    if not force_new_version:
        # Check current secret versions
        access_request = secretmanager_v1.AccessSecretVersionRequest(
            name=f"projects/{project_id}/secrets/{name}/versions/latest"
        )
        response = client.access_secret_version(request=access_request)
        secret_name = response.name
        latest_value = response.payload.data.decode("utf-8")

        if latest_value == value:
            print(f"...Secret {name} already has the latest value, skipping update.")
            return secret_name, latest_value

    # If the value is different, add a new version
    add_request = secretmanager_v1.AddSecretVersionRequest(
        parent=f"projects/{project_id}/secrets/{name}",
        payload=secretmanager_v1.SecretPayload(data=value.encode("utf-8")),
    )
    version = client.add_secret_version(request=add_request)
    return version.name, value


def create_secret(name, value):
    print(f"Creating secret: {name}")
    value = str(value)

    request = secretmanager_v1.CreateSecretRequest(
        parent=f"projects/{project_id}",
        secret_id=name,
        secret=secretmanager_v1.Secret(
            replication=secretmanager_v1.Replication(
                automatic=secretmanager_v1.Replication.Automatic(),
            ),
        ),
    )
    client.create_secret(request=request)
    return sync_secret_value(name, value, force_new_version=True)


def update_secret(name, value):
    print(f"Updating secret: {name}")
    return sync_secret_value(name, value)


def delete_secret(name):
    print(f"Deleting secret: {name}")
    request = secretmanager_v1.DeleteSecretRequest(name=f"projects/{project_id}/secrets/{name}")
    client.delete_secret(request=request)


def main():
    existing_names = get_existing_secret_names()

    tasks = []
    keys_to_sync = set()
    for line in sys.stdin:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        env_var, val = line.split("=", maxsplit=1)
        key = f"{secret_name_prefix}-{env_var.strip()}"
        keys_to_sync.add(key)

        if key in existing_names:
            tasks.append((update_secret, key, val))
        else:
            tasks.append((create_secret, key, val))

    key_pattern = re.compile(rf"^{re.escape(secret_name_prefix)}-([A-Z_]+)$")
    for key in existing_names:
        if key_pattern.match(key) and key not in keys_to_sync:
            tasks.append((delete_secret, key))

    # Execute tasks concurrently using ThreadPoolExecutor
    with ThreadPoolExecutor() as executor:
        futures = [executor.submit(func, key, val) for func, key, val in tasks]
        for future in futures:
            future.result()  # Wait for completion and raise any exceptions


if __name__ == "__main__":
    main()
