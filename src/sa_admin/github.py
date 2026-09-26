"""
GitHub Content Manager for Ballot Proposals
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Provides Git commit/push service for ballot content (YAML, Markdown, images)
using the GitHub REST API (Trees & Commits API), with GitHub App authentication,
conflict detection, and rebase-and-retry logic.
"""

from concurrent.futures import ThreadPoolExecutor
import base64
import logging
import os
import pathlib
import time
from typing import Any, Dict, List, Optional, Tuple, Union

from django.conf import settings
import frontmatter
import jwt
import requests
import yaml

logger = logging.getLogger(__name__)


class GitConflictError(Exception):
    """
    Raised when updating a git ref fails due to concurrent modification (422 / 409).
    """
    def __init__(self, message: str, head_sha: str, tree_sha: str, conflicting_files: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.head_sha = head_sha
        self.tree_sha = tree_sha
        self.conflicting_files = conflicting_files or {}


class GitHubContentManager:
    """
    Manages reading and committing ballot content via GitHub REST API without a local clone.
    """

    def __init__(
        self,
        owner: Optional[str] = None,
        repo: Optional[str] = None,
        branch: Optional[str] = None,
        flavor: Optional[str] = None,
        app_id: Optional[str] = None,
        installation_id: Optional[str] = None,
        private_key: Optional[Union[str, bytes]] = None,
        private_key_path: Optional[str] = None,
        token: Optional[str] = None,
    ):
        full_repo = getattr(settings, 'GITHUB_REPO', '')
        if repo and '/' in repo:
            self.owner, self.repo = repo.split('/', 1)
        elif owner and repo:
            self.owner = owner
            self.repo = repo
        elif '/' in full_repo:
            self.owner, self.repo = full_repo.split('/', 1)
        else:
            raise ValueError("GitHub repository not specified in either the 'repo' argument or the 'GITHUB_REPO' setting.")

        self.branch = branch or settings.GITHUB_BRANCH
        if not self.branch:
            raise ValueError("GitHub branch not specified in either the 'branch' argument or the 'GITHUB_BRANCH' setting.")

        self.flavor = flavor or getattr(settings, 'SHAREABOUTS', {}).get('FLAVOR')
        if not self.flavor:
            raise ValueError("Shareabouts flavor not specified in either the 'flavor' argument or the 'SHAREABOUTS' setting.")

        self.app_id = app_id or getattr(settings, 'GITHUB_APP_ID', None)
        self.installation_id = installation_id or getattr(settings, 'GITHUB_APP_INSTALLATION_ID', None)
        self.private_key = private_key or getattr(settings, 'GITHUB_APP_PRIVATE_KEY', None)
        self.private_key_path = private_key_path or getattr(settings, 'GITHUB_APP_PRIVATE_KEY_PATH', None)
        self.token = token or getattr(settings, 'GITHUB_TOKEN', None)

        self._cached_token: Optional[str] = None
        self._cached_token_expires_at: float = 0
        self.api_base = f"https://api.github.com/repos/{self.owner}/{self.repo}"

    def _get_private_key_bytes(self) -> bytes:
        if self.private_key:
            if isinstance(self.private_key, str):
                return self.private_key.encode('utf-8')
            return self.private_key
        if self.private_key_path and os.path.exists(self.private_key_path):
            with open(self.private_key_path, 'rb') as f:
                return f.read()
        raise ValueError("GitHub App private key not configured or file not found.")

    def get_token(self) -> str:
        """
        Get a valid GitHub access token (either App Installation token or PAT).
        """
        if self.token:
            return self.token

        now = time.time()
        if self._cached_token and now < (self._cached_token_expires_at - 60):
            return self._cached_token

        if not self.app_id or not self.installation_id:
            raise ValueError("Missing GitHub App ID or Installation ID.")

        private_key_bytes = self._get_private_key_bytes()
        now_int = int(now)
        jwt_payload = {
            "iat": now_int - 60,
            "exp": now_int + 600,
            "iss": str(self.app_id),
        }
        app_jwt = jwt.encode(jwt_payload, private_key_bytes, algorithm="RS256")

        headers = {
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github+json",
        }
        url = f"https://api.github.com/app/installations/{self.installation_id}/access_tokens"
        resp = requests.post(url, headers=headers, timeout=15)
        if resp.status_code != 201:
            raise RuntimeError(f"Failed to obtain installation access token ({resp.status_code}): {resp.text}")

        data = resp.json()
        self._cached_token = data["token"]
        self._cached_token_expires_at = now + 3000  # valid for 1 hour, refresh early
        return self._cached_token

    def _request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        token = self.get_token()
        headers = kwargs.pop("headers", {})
        headers.setdefault("Authorization", f"Bearer {token}")
        headers.setdefault("Accept", "application/vnd.github+json")

        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            url = endpoint
        else:
            url = f"{self.api_base}/{endpoint.lstrip('/')}"

        kwargs.setdefault("timeout", 20)
        return requests.request(method, url, headers=headers, **kwargs)

    # ------------------------------------------------------------------------
    # Git Trees & Commits API helpers
    # ------------------------------------------------------------------------

    def get_head_sha(self) -> str:
        """
        1. GET /repos/{owner}/{repo}/git/refs/heads/{branch}
        """
        resp = self._request("GET", f"git/refs/heads/{self.branch}")
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch branch '{self.branch}' ({resp.status_code}): {resp.text}")
        return resp.json()["object"]["sha"]

    def get_commit(self, commit_sha: str) -> Dict[str, Any]:
        """
        2. GET /repos/{owner}/{repo}/git/commits/{commit_sha}
        """
        resp = self._request("GET", f"git/commits/{commit_sha}")
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch commit '{commit_sha}' ({resp.status_code}): {resp.text}")
        return resp.json()

    def get_tree(self, tree_sha: str, recursive: bool = True) -> Dict[str, Any]:
        """
        3. GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=true
        """
        params = {"recursive": "true"} if recursive else {}
        resp = self._request("GET", f"git/trees/{tree_sha}", params=params)
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch tree '{tree_sha}' ({resp.status_code}): {resp.text}")
        return resp.json()

    def get_blob(self, blob_sha: str) -> Tuple[bytes, str]:
        """
        4. GET /repos/{owner}/{repo}/git/blobs/{blob_sha}
        Returns (raw_bytes, encoding)
        """
        resp = self._request("GET", f"git/blobs/{blob_sha}")
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch blob '{blob_sha}' ({resp.status_code}): {resp.text}")
        data = resp.json()
        content = data.get("content", "")
        encoding = data.get("encoding", "utf-8")
        if encoding == "base64":
            return base64.b64decode(content), encoding
        return content.encode("utf-8"), encoding

    def create_blob(self, content: Union[str, bytes], is_binary: bool = False) -> str:
        """
        6. POST /repos/{owner}/{repo}/git/blobs
        """
        if is_binary or isinstance(content, bytes):
            if isinstance(content, str):
                payload = {"content": content, "encoding": "base64"}
            else:
                payload = {"content": base64.b64encode(content).decode("ascii"), "encoding": "base64"}
        else:
            payload = {"content": str(content), "encoding": "utf-8"}

        resp = self._request("POST", "git/blobs", json=payload)
        if resp.status_code != 201:
            raise RuntimeError(f"Failed to create blob ({resp.status_code}): {resp.text}")
        return resp.json()["sha"]

    def create_tree(self, base_tree_sha: str, tree_entries: List[Dict[str, Any]]) -> str:
        """
        7. POST /repos/{owner}/{repo}/git/trees
        tree_entries: [{"path": "...", "mode": "100644", "type": "blob", "sha": "..."}]
        """
        payload = {
            "base_tree": base_tree_sha,
            "tree": tree_entries,
        }
        resp = self._request("POST", "git/trees", json=payload)
        if resp.status_code != 201:
            raise RuntimeError(f"Failed to create tree ({resp.status_code}): {resp.text}")
        return resp.json()["sha"]

    def create_commit(
        self,
        message: str,
        tree_sha: str,
        parent_sha: str,
        author: Optional[Dict[str, str]] = None,
        committer: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        8. POST /repos/{owner}/{repo}/git/commits
        """
        payload = {
            "message": message,
            "tree": tree_sha,
            "parents": [parent_sha],
        }
        if author:
            payload["author"] = author
        if committer:
            payload["committer"] = committer

        resp = self._request("POST", "git/commits", json=payload)
        if resp.status_code != 201:
            raise RuntimeError(f"Failed to create commit ({resp.status_code}): {resp.text}")
        return resp.json()["sha"]

    def update_ref(self, commit_sha: str, force: bool = False) -> requests.Response:
        """
        9. PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}
        """
        payload = {"sha": commit_sha, "force": force}
        return self._request("PATCH", f"git/refs/heads/{self.branch}", json=payload)

    # ------------------------------------------------------------------------
    # High-level Ballot Proposal operations
    # ------------------------------------------------------------------------

    @property
    def ballot_folder(self) -> str:
        return f"src/flavors/{self.flavor}/ballot"

    @property
    def static_ballot_folder(self) -> str:
        return f"src/flavors/{self.flavor}/static/ballot"

    def get_ballot_state(self) -> Dict[str, Any]:
        """
        Loads the current state of all ballot proposals from GitHub.
        Returns:
            {
                "head_sha": commit_sha,
                "tree_sha": tree_sha,
                "proposals": [...],
                "files": {path: sha}
            }
        """
        head_sha = self.get_head_sha()
        commit = self.get_commit(head_sha)
        tree_sha = commit["tree"]["sha"]
        tree_data = self.get_tree(tree_sha, recursive=True)

        ballot_prefix = self.ballot_folder + "/"

        ballot_items = [
            item for item in tree_data.get("tree", [])
            if item["type"] == "blob" and item["path"].startswith(ballot_prefix)
        ]
        files_map = {item["path"]: item["sha"] for item in ballot_items}

        def fetch_blob(item):
            raw_bytes, _ = self.get_blob(item["sha"])
            return item, raw_bytes

        with ThreadPoolExecutor(max_workers=10) as executor:
            fetched_items = list(executor.map(fetch_blob, ballot_items))

        proposals_by_slug: Dict[str, Dict[str, Any]] = {}
        for item, raw_bytes in fetched_items:
            rel_path = item["path"][len(ballot_prefix):]
            parts = rel_path.split("/", 1)
            if len(parts) != 2:
                continue
            slug, filename = parts
            if slug not in proposals_by_slug:
                proposals_by_slug[slug] = {
                    "slug": slug,
                    "info": {},
                    "translations": {},
                    "files": {},
                }
            proposals_by_slug[slug]["files"][item["path"]] = item["sha"]

            raw_text = raw_bytes.decode("utf-8", errors="replace")

            if filename == "info.yaml":
                try:
                    proposals_by_slug[slug]["info"] = yaml.safe_load(raw_text) or {}
                except Exception as e:
                    logger.warning("Failed to parse YAML for %s: %s", item["path"], e)
            elif filename.endswith(".md"):
                lang = filename[:-3]
                try:
                    post = frontmatter.loads(raw_text)
                    proposals_by_slug[slug]["translations"][lang] = {
                        "language": post.get("language", lang),
                        "title": post.get("title", ""),
                        "image_alt": post.get("image_alt", ""),
                        "last_updated": str(post.get("last_updated", "")),
                        "content": post.content,
                    }
                except Exception as e:
                    logger.warning("Failed to parse Markdown for %s: %s", item["path"], e)

        return {
            "head_sha": head_sha,
            "tree_sha": tree_sha,
            "proposals": list(proposals_by_slug.values()),
            "files": files_map,
        }

    def commit_proposal_changes(
        self,
        base_sha: str,
        files_to_update: Dict[str, Union[str, bytes]],
        message: Optional[str] = None,
        slug: Optional[str] = None,
        user_sso_id: Optional[str] = None,
        user_name: Optional[str] = None,
        user_email: Optional[str] = None,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        """
        Commits changes to the repository with rebase-and-retry logic for concurrent edits.
        files_to_update: {repo_relative_path: content_str_or_bytes}
        """
        current_base_sha = base_sha
        author = {
            "name": "Shareabouts PB Boston",
            "email": "shareabouts-bot@poepublic.com",
        }
        committer = {
            "name": user_name or "Shareabouts Admin",
            "email": user_email or (f"{user_sso_id}@boston.gov" if user_sso_id else "admin@poepublic.com"),
        }

        default_msg = f"Update proposal {slug}" if slug else "Update ballot content"
        if user_sso_id:
            commit_msg = f"{message or default_msg} [SSO: {user_sso_id}]"
        else:
            commit_msg = message or default_msg

        # Upload blobs first
        tree_entries = []
        for path, content in files_to_update.items():
            is_binary = isinstance(content, bytes) or path.startswith(self.static_ballot_folder)
            blob_sha = self.create_blob(content, is_binary=is_binary)
            tree_entries.append({
                "path": path,
                "mode": "100644",
                "type": "blob",
                "sha": blob_sha,
            })

        for attempt in range(max_retries):
            head_sha = self.get_head_sha()

            if head_sha != current_base_sha and attempt == 0:
                # Concurrent update occurred before push
                conflicts, tree_sha = self._check_conflicts(current_base_sha, head_sha, list(files_to_update.keys()))
                if conflicts:
                    raise GitConflictError(
                        "Another admin has saved changes since you opened this page. Conflicting updates detected.",
                        head_sha=head_sha,
                        tree_sha=tree_sha,
                        conflicting_files=conflicts,
                    )
                # Rebase on new head
                current_base_sha = head_sha

            parent_commit = self.get_commit(current_base_sha)
            base_tree_sha = parent_commit["tree"]["sha"]

            new_tree_sha = self.create_tree(base_tree_sha, tree_entries)

            new_commit_sha = self.create_commit(
                message=commit_msg,
                tree_sha=new_tree_sha,
                parent_sha=current_base_sha,
                author=author,
                committer=committer,
            )

            ref_resp = self.update_ref(new_commit_sha, force=False)
            if ref_resp.status_code == 200:
                return {
                    "status": "success",
                    "commit_sha": new_commit_sha,
                    "tree_sha": new_tree_sha,
                    "head_sha": new_commit_sha,
                }
            elif ref_resp.status_code == 422:
                # Fast-forward rejected
                new_head_sha = self.get_head_sha()
                conflicts, tree_sha = self._check_conflicts(current_base_sha, new_head_sha, list(files_to_update.keys()))
                if conflicts:
                    raise GitConflictError(
                        "Another admin has saved changes since you opened this page. Conflicting updates detected.",
                        head_sha=new_head_sha,
                        tree_sha=tree_sha,
                        conflicting_files=conflicts,
                    )
                current_base_sha = new_head_sha
                logger.info("Fast-forward failed, retrying rebase on %s (attempt %d)", current_base_sha, attempt + 1)
            else:
                raise RuntimeError(f"Unexpected error updating ref ({ref_resp.status_code}): {ref_resp.text}")

        latest_head = self.get_head_sha()
        head_commit = self.get_commit(latest_head)
        latest_tree = head_commit["tree"]["sha"]
        raise GitConflictError(
            "Could not complete commit after retries due to concurrent activity.",
            head_sha=latest_head,
            tree_sha=latest_tree,
            conflicting_files=self._get_current_files(list(files_to_update.keys()), tree_sha=latest_tree),
        )

    def _check_conflicts(self, base_sha: str, new_head_sha: str, target_files: List[str]) -> Tuple[Dict[str, Any], str]:
        head_commit = self.get_commit(new_head_sha)
        tree_sha = head_commit["tree"]["sha"]

        resp = self._request("GET", f"compare/{base_sha}...{new_head_sha}")
        if resp.status_code != 200:
            return self._get_current_files(target_files, tree_sha=tree_sha), tree_sha

        data = resp.json()
        changed_paths = {f["filename"] for f in data.get("files", [])}
        intersect = changed_paths.intersection(set(target_files))
        if intersect:
            return self._get_current_files(list(intersect), tree_sha=tree_sha), tree_sha
        return {}, tree_sha

    def _get_current_files(self, paths: List[str], tree_sha: Optional[str] = None) -> Dict[str, Any]:
        if not tree_sha:
            head_sha = self.get_head_sha()
            tree_sha = self.get_commit(head_sha)["tree"]["sha"]
        tree_data = self.get_tree(tree_sha, recursive=True)
        path_to_sha = {item["path"]: item["sha"] for item in tree_data.get("tree", []) if item["type"] == "blob"}

        current_files = {}
        for path in paths:
            if path in path_to_sha:
                blob_bytes, _ = self.get_blob(path_to_sha[path])
                current_files[path] = {
                    "sha": path_to_sha[path],
                    "content": blob_bytes.decode("utf-8", errors="replace"),
                }
            else:
                current_files[path] = None
        return current_files
