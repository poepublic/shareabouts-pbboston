"""
GitHub Content Manager for Ballot Proposals
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Provides Git commit/push service for ballot content (YAML, Markdown, images)
using PyGithub (Trees & Commits API), with GitHub App authentication,
conflict detection, and rebase-and-retry logic.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import base64
import logging
import os
from typing import Any, Dict, List, Optional, Tuple, Union

from django.conf import settings
import frontmatter
from github import Github, Auth, InputGitTreeElement, InputGitAuthor, GithubException
from github.Repository import Repository
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
        installation_id: Optional[Union[str, int]] = None,
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

        self.branch = branch or getattr(settings, 'GITHUB_BRANCH', None)
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

        self._client: Optional[Github] = None
        self._gh_repo: Optional[Repository] = None

    def _get_private_key_str(self) -> str:
        if self.private_key:
            if isinstance(self.private_key, bytes):
                return self.private_key.decode('utf-8')
            return self.private_key
        if self.private_key_path and os.path.exists(self.private_key_path):
            with open(self.private_key_path, 'r', encoding='utf-8') as f:
                return f.read()
        raise ValueError("GitHub App private key not configured or file not found.")

    def get_client(self) -> Github:
        """
        Return an authenticated PyGithub Github instance.
        """
        if self._client:
            return self._client

        if self.token:
            auth = Auth.Token(self.token)
        elif self.app_id and self.installation_id:
            key_str = self._get_private_key_str()
            app_auth = Auth.AppAuth(str(self.app_id), key_str)
            auth = app_auth.get_installation_auth(int(self.installation_id))
        else:
            raise ValueError("Missing GitHub App credentials or Personal Access Token.")

        self._client = Github(auth=auth)
        return self._client

    @property
    def gh_repo(self) -> Repository:
        if self._gh_repo is None:
            client = self.get_client()
            self._gh_repo = client.get_repo(f"{self.owner}/{self.repo}")
        return self._gh_repo

    @property
    def ballot_folder(self) -> str:
        return f"src/flavors/{self.flavor}/ballot"

    @property
    def static_ballot_folder(self) -> str:
        return f"src/flavors/{self.flavor}/static/ballot"

    def get_head_sha(self) -> str:
        ref = self.gh_repo.get_git_ref(f"heads/{self.branch}")
        return ref.object.sha

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
        repo = self.gh_repo
        ref = repo.get_git_ref(f"heads/{self.branch}")
        head_sha = ref.object.sha
        commit = repo.get_git_commit(head_sha)
        tree_sha = commit.tree.sha
        tree_data = repo.get_git_tree(tree_sha, recursive=True)

        ballot_prefix = self.ballot_folder + "/"

        ballot_items = [
            item for item in tree_data.tree
            if item.type == "blob" and item.path.startswith(ballot_prefix)
        ]
        files_map = {item.path: item.sha for item in ballot_items}

        def fetch_blob(item):
            blob = repo.get_git_blob(item.sha)
            if blob.encoding == 'base64':
                raw_bytes = base64.b64decode(blob.content)
            else:
                raw_bytes = blob.content.encode('utf-8')
            return item, raw_bytes

        with ThreadPoolExecutor(max_workers=10) as executor:
            fetched_items = list(executor.map(fetch_blob, ballot_items))

        proposals_by_slug: Dict[str, Dict[str, Any]] = {}
        for item, raw_bytes in fetched_items:
            rel_path = item.path[len(ballot_prefix):]
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
            proposals_by_slug[slug]["files"][item.path] = item.sha

            raw_text = raw_bytes.decode("utf-8", errors="replace")

            if filename == "info.yaml":
                try:
                    proposals_by_slug[slug]["info"] = yaml.safe_load(raw_text) or {}
                except Exception as e:
                    logger.warning("Failed to parse YAML for %s: %s", item.path, e)
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
                    logger.warning("Failed to parse Markdown for %s: %s", item.path, e)

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
        repo = self.gh_repo
        current_base_sha = base_sha

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        author = InputGitAuthor(
            name="Shareabouts PB Boston",
            email="shareabouts-bot@poepublic.com",
            date=now_iso,
        )
        committer = InputGitAuthor(
            name=user_name or "Shareabouts Admin",
            email=user_email or (f"{user_sso_id}@boston.gov" if user_sso_id else "admin@poepublic.com"),
            date=now_iso,
        )

        default_msg = f"Update proposal {slug}" if slug else "Update ballot content"
        if user_sso_id:
            commit_msg = f"{message or default_msg} [SSO: {user_sso_id}]"
        else:
            commit_msg = message or default_msg

        # Upload blobs and create tree elements
        tree_elements = []
        for path, content in files_to_update.items():
            is_binary = isinstance(content, bytes) or path.startswith(self.static_ballot_folder)
            if is_binary or isinstance(content, bytes):
                if isinstance(content, bytes):
                    b64_content = base64.b64encode(content).decode("ascii")
                else:
                    b64_content = content
                blob = repo.create_git_blob(b64_content, "base64")
            else:
                blob = repo.create_git_blob(str(content), "utf-8")

            tree_elements.append(
                InputGitTreeElement(
                    path=path,
                    mode="100644",
                    type="blob",
                    sha=blob.sha,
                )
            )

        for attempt in range(max_retries):
            ref = repo.get_git_ref(f"heads/{self.branch}")
            head_sha = ref.object.sha

            if head_sha != current_base_sha and attempt == 0:
                # Concurrent update occurred before push
                conflicts, tree_sha = self._check_conflicts(repo, current_base_sha, head_sha, list(files_to_update.keys()))
                if conflicts:
                    raise GitConflictError(
                        "Another admin has saved changes since you opened this page. Conflicting updates detected.",
                        head_sha=head_sha,
                        tree_sha=tree_sha,
                        conflicting_files=conflicts,
                    )
                current_base_sha = head_sha

            parent_commit = repo.get_git_commit(current_base_sha)
            base_tree = parent_commit.tree

            new_tree = repo.create_git_tree(tree_elements, base_tree)
            new_commit = repo.create_git_commit(
                message=commit_msg,
                tree=new_tree,
                parents=[parent_commit],
                author=author,
                committer=committer,
            )

            try:
                ref.edit(sha=new_commit.sha, force=False)
                return {
                    "status": "success",
                    "commit_sha": new_commit.sha,
                    "tree_sha": new_tree.sha,
                    "head_sha": new_commit.sha,
                }
            except GithubException as exc:
                if exc.status == 422:
                    new_ref = repo.get_git_ref(f"heads/{self.branch}")
                    new_head_sha = new_ref.object.sha
                    conflicts, tree_sha = self._check_conflicts(repo, current_base_sha, new_head_sha, list(files_to_update.keys()))
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
                    raise

        latest_ref = repo.get_git_ref(f"heads/{self.branch}")
        latest_head = latest_ref.object.sha
        head_commit = repo.get_git_commit(latest_head)
        latest_tree = head_commit.tree.sha
        raise GitConflictError(
            "Could not complete commit after retries due to concurrent activity.",
            head_sha=latest_head,
            tree_sha=latest_tree,
            conflicting_files=self._get_current_files(repo, list(files_to_update.keys()), tree_sha=latest_tree),
        )

    def _check_conflicts(self, repo: Repository, base_sha: str, new_head_sha: str, target_files: List[str]) -> Tuple[Dict[str, Any], str]:
        head_commit = repo.get_git_commit(new_head_sha)
        tree_sha = head_commit.tree.sha

        try:
            comparison = repo.compare(base_sha, new_head_sha)
            changed_paths = {f.filename for f in comparison.files}
        except Exception:
            return self._get_current_files(repo, target_files, tree_sha=tree_sha), tree_sha

        intersect = changed_paths.intersection(set(target_files))
        if intersect:
            return self._get_current_files(repo, list(intersect), tree_sha=tree_sha), tree_sha
        return {}, tree_sha

    def _get_current_files(self, repo: Repository, paths: List[str], tree_sha: Optional[str] = None) -> Dict[str, Any]:
        if not tree_sha:
            ref = repo.get_git_ref(f"heads/{self.branch}")
            commit = repo.get_git_commit(ref.object.sha)
            tree_sha = commit.tree.sha

        tree_data = repo.get_git_tree(tree_sha, recursive=True)
        path_to_sha = {item.path: item.sha for item in tree_data.tree if item.type == "blob"}

        current_files = {}
        for path in paths:
            if path in path_to_sha:
                blob = repo.get_git_blob(path_to_sha[path])
                content = base64.b64decode(blob.content).decode("utf-8", errors="replace") if blob.encoding == "base64" else blob.content
                current_files[path] = {
                    "sha": path_to_sha[path],
                    "content": content,
                }
            else:
                current_files[path] = None
        return current_files
