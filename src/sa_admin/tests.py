import base64
import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, RequestFactory, override_settings

from github import GithubException
from sa_admin.github import GitHubContentManager, GitConflictError
from sa_admin.views import (
    ballot_editor,
    ballot_proposals_api,
    ballot_proposal_save_api,
    ballot_image_proxy,
    ballot_translate_api,
)
from sa_admin.translation import GoogleTranslationService
from sa_util.config import get_shareabouts_config
from sa_util.api import ShareaboutsApi


class GitHubContentManagerUnitTests(SimpleTestCase):
    def setUp(self):
        self.mgr = GitHubContentManager(
            owner='poepublic',
            repo='shareabouts-pbboston',
            branch='test-branch',
            flavor='cycle3',
            token='test-token',
        )
        self.mock_repo = MagicMock()
        self.mgr._gh_repo = self.mock_repo

    def test_get_head_sha(self):
        mock_ref = MagicMock()
        mock_ref.object.sha = 'abc123commit'
        self.mock_repo.get_git_ref.return_value = mock_ref

        head_sha = self.mgr.get_head_sha()
        self.assertEqual(head_sha, 'abc123commit')
        self.mock_repo.get_git_ref.assert_called_with('heads/test-branch')

    def test_get_ballot_state_parsing(self):
        # 1. get_git_ref
        mock_ref = MagicMock()
        mock_ref.object.sha = 'headsha'
        self.mock_repo.get_git_ref.return_value = mock_ref

        # 2. get_git_commit
        mock_commit = MagicMock()
        mock_commit.tree.sha = 'treesha'
        self.mock_repo.get_git_commit.return_value = mock_commit

        # 3. get_git_tree
        item1 = MagicMock(path='src/flavors/cycle3/ballot/test-prop/info.yaml', type='blob', sha='infosha')
        item2 = MagicMock(path='src/flavors/cycle3/ballot/test-prop/en.md', type='blob', sha='mdsha')
        mock_tree = MagicMock()
        mock_tree.tree = [item1, item2]
        self.mock_repo.get_git_tree.return_value = mock_tree

        # 4. get_git_blob
        blob_info = MagicMock(content='amount: 250000\nimage: /static/ballot/test.png\n', encoding='utf-8')
        blob_md = MagicMock(content='---\nlanguage: en\ntitle: Test Proposal\nimage_alt: Alt text\n---\n\nTest description body.\n', encoding='utf-8')
        self.mock_repo.get_git_blob.side_effect = lambda sha: blob_info if sha == 'infosha' else blob_md

        state = self.mgr.get_ballot_state()
        self.assertEqual(state['head_sha'], 'headsha')
        self.assertEqual(state['tree_sha'], 'treesha')
        self.assertEqual(len(state['proposals']), 1)

        prop = state['proposals'][0]
        self.assertEqual(prop['slug'], 'test-prop')
        self.assertEqual(prop['info']['amount'], 250000)
        self.assertEqual(prop['translations']['en']['title'], 'Test Proposal')
        self.assertEqual(prop['translations']['en']['content'], 'Test description body.')

    def test_commit_proposal_changes_success(self):
        # 1. get_git_ref
        mock_ref = MagicMock()
        mock_ref.object.sha = 'basehead'
        self.mock_repo.get_git_ref.return_value = mock_ref

        # 2. create_git_blob
        blob = MagicMock(sha='blobsha1')
        self.mock_repo.create_git_blob.return_value = blob

        # 3. get_git_commit
        parent_commit = MagicMock()
        parent_commit.tree.sha = 'basetreesha'
        self.mock_repo.get_git_commit.return_value = parent_commit

        # 4. create_git_tree
        new_tree = MagicMock()
        new_tree.sha = 'newtreesha'
        self.mock_repo.create_git_tree.return_value = new_tree

        # 5. create_git_commit
        new_commit = MagicMock()
        new_commit.sha = 'newcommitsha'
        self.mock_repo.create_git_commit.return_value = new_commit

        result = self.mgr.commit_proposal_changes(
            base_sha='basehead',
            files_to_update={'src/flavors/cycle3/ballot/prop1/info.yaml': 'amount: 1000'},
            slug='prop1',
            user_sso_id='user123',
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['commit_sha'], 'newcommitsha')
        mock_ref.edit.assert_called_with(sha='newcommitsha', force=False)

    def test_commit_proposal_changes_empty_raises_value_error(self):
        # 1. get_git_ref
        mock_ref = MagicMock()
        mock_ref.object.sha = 'basehead'
        self.mock_repo.get_git_ref.return_value = mock_ref

        # 2. create_git_blob
        blob = MagicMock(sha='blobsha1')
        self.mock_repo.create_git_blob.return_value = blob

        # 3. get_git_commit
        parent_commit = MagicMock()
        parent_commit.tree.sha = 'same_treesha'
        self.mock_repo.get_git_commit.return_value = parent_commit

        # 4. create_git_tree returns same sha as base_tree
        new_tree = MagicMock()
        new_tree.sha = 'same_treesha'
        self.mock_repo.create_git_tree.return_value = new_tree

        with self.assertRaises(ValueError) as cm:
            self.mgr.commit_proposal_changes(
                base_sha='basehead',
                files_to_update={'src/flavors/cycle3/ballot/prop1/info.yaml': 'amount: 1000'},
                slug='prop1',
                allow_empty=False,
            )

        self.assertIn("No changes detected", str(cm.exception))
        self.mock_repo.create_git_commit.assert_not_called()
        mock_ref.edit.assert_not_called()

    def test_commit_proposal_changes_allow_empty_true(self):
        # 1. get_git_ref
        mock_ref = MagicMock()
        mock_ref.object.sha = 'basehead'
        self.mock_repo.get_git_ref.return_value = mock_ref

        # 2. create_git_blob
        blob = MagicMock(sha='blobsha1')
        self.mock_repo.create_git_blob.return_value = blob

        # 3. get_git_commit
        parent_commit = MagicMock()
        parent_commit.tree.sha = 'same_treesha'
        self.mock_repo.get_git_commit.return_value = parent_commit

        # 4. create_git_tree returns same sha as base_tree
        new_tree = MagicMock()
        new_tree.sha = 'same_treesha'
        self.mock_repo.create_git_tree.return_value = new_tree

        # 5. create_git_commit
        new_commit = MagicMock()
        new_commit.sha = 'emptycommitsha'
        self.mock_repo.create_git_commit.return_value = new_commit

        result = self.mgr.commit_proposal_changes(
            base_sha='basehead',
            files_to_update={'src/flavors/cycle3/ballot/prop1/info.yaml': 'amount: 1000'},
            slug='prop1',
            allow_empty=True,
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['commit_sha'], 'emptycommitsha')
        self.mock_repo.create_git_commit.assert_called_once()
        mock_ref.edit.assert_called_with(sha='emptycommitsha', force=False)

    def test_commit_proposal_changes_conflict(self):
        # 1. get_git_ref returns moved head
        mock_ref = MagicMock()
        mock_ref.object.sha = 'movedhead'
        self.mock_repo.get_git_ref.return_value = mock_ref

        # 2. create_git_blob
        blob = MagicMock(sha='blobsha1')
        self.mock_repo.create_git_blob.return_value = blob

        # 3. compare returns changed file intersecting with target_files
        mock_comp = MagicMock()
        file_change = MagicMock()
        file_change.filename = 'src/flavors/cycle3/ballot/prop1/info.yaml'
        mock_comp.files = [file_change]
        self.mock_repo.compare.return_value = mock_comp

        # 4. get_git_commit for movedhead
        head_commit = MagicMock()
        head_commit.tree.sha = 'movedtree'
        self.mock_repo.get_git_commit.return_value = head_commit

        # 5. get_git_tree for movedtree
        item = MagicMock(path='src/flavors/cycle3/ballot/prop1/info.yaml', type='blob', sha='server_blob')
        mock_tree = MagicMock()
        mock_tree.tree = [item]
        self.mock_repo.get_git_tree.return_value = mock_tree

        blob2 = MagicMock(content='amount: 9999\n', encoding='utf-8')
        self.mock_repo.get_git_blob.return_value = blob2

        with self.assertRaises(GitConflictError) as cm:
            self.mgr.commit_proposal_changes(
                base_sha='oldhead',
                files_to_update={'src/flavors/cycle3/ballot/prop1/info.yaml': 'amount: 1000'},
                slug='prop1',
                user_sso_id='user123',
            )

        err = cm.exception
        self.assertEqual(err.head_sha, 'movedhead')
        self.assertIn('src/flavors/cycle3/ballot/prop1/info.yaml', err.conflicting_files)

    def test_commit_proposal_changes_rename_prunes_old_files(self):
        mock_ref = MagicMock()
        mock_ref.object.sha = 'basehead'
        self.mock_repo.get_git_ref.return_value = mock_ref

        blob = MagicMock(sha='newblobsha')
        self.mock_repo.create_git_blob.return_value = blob

        parent_commit = MagicMock()
        parent_commit.tree.sha = 'basetreesha'
        self.mock_repo.get_git_commit.return_value = parent_commit

        # Mock base_tree containing old proposal files
        old_item1 = MagicMock(path='src/flavors/cycle3/ballot/prop-old/info.yaml', type='blob', sha='oldblob1')
        old_item2 = MagicMock(path='src/flavors/cycle3/ballot/prop-old/en.md', type='blob', sha='oldblob2')
        other_item = MagicMock(path='src/flavors/cycle3/ballot/other-prop/info.yaml', type='blob', sha='otherblob')
        mock_tree = MagicMock()
        mock_tree.tree = [old_item1, old_item2, other_item]
        self.mock_repo.get_git_tree.return_value = mock_tree

        new_tree = MagicMock(sha='newtreesha')
        self.mock_repo.create_git_tree.return_value = new_tree

        new_commit = MagicMock(sha='newcommitsha')
        self.mock_repo.create_git_commit.return_value = new_commit

        result = self.mgr.commit_proposal_changes(
            base_sha='basehead',
            files_to_update={'src/flavors/cycle3/ballot/prop-new/info.yaml': 'amount: 2000'},
            original_slug='prop-old',
            slug='prop-new',
            user_sso_id='user123',
        )

        self.assertEqual(result['status'], 'success')
        # Verify create_git_tree was called with deletions for the old proposal files
        tree_elements = self.mock_repo.create_git_tree.call_args[0][0]
        paths_to_delete = [elem._InputGitTreeElement__path for elem in tree_elements if elem._InputGitTreeElement__sha is None]
        self.assertIn('src/flavors/cycle3/ballot/prop-old/info.yaml', paths_to_delete)
        self.assertIn('src/flavors/cycle3/ballot/prop-old/en.md', paths_to_delete)

    def test_commit_proposal_changes_collision_raises_error(self):
        mock_ref = MagicMock()
        mock_ref.object.sha = 'basehead'
        self.mock_repo.get_git_ref.return_value = mock_ref

        parent_commit = MagicMock()
        parent_commit.tree.sha = 'basetreesha'
        self.mock_repo.get_git_commit.return_value = parent_commit

        existing_item = MagicMock(path='src/flavors/cycle3/ballot/already-exists/info.yaml', type='blob')
        mock_tree = MagicMock()
        mock_tree.tree = [existing_item]
        self.mock_repo.get_git_tree.return_value = mock_tree

        with self.assertRaises(ValueError) as cm:
            self.mgr.commit_proposal_changes(
                base_sha='basehead',
                files_to_update={'src/flavors/cycle3/ballot/already-exists/info.yaml': 'amount: 2000'},
                original_slug='prop-old',
                slug='already-exists',
            )
        self.assertIn("already exists", str(cm.exception))

    def test_get_image_blob_found(self):
        mock_content = MagicMock()
        mock_content.content = "base64content"
        mock_content.decoded_content = b"fake-jpeg-bytes"
        self.mock_repo.get_contents.return_value = mock_content

        result = self.mgr.get_image_blob("test-image.jpg")
        self.assertIsNotNone(result)
        raw_bytes, ct = result
        self.assertEqual(raw_bytes, b"fake-jpeg-bytes")
        self.assertEqual(ct, "image/jpeg")
        self.mock_repo.get_contents.assert_called_with(
            "src/flavors/cycle3/static/ballot/test-image.jpg",
            ref="test-branch"
        )

    def test_get_image_blob_large_file_falls_back_to_git_blob(self):
        mock_content = MagicMock()
        mock_content.content = None
        mock_content.sha = "blobsha999"
        self.mock_repo.get_contents.return_value = mock_content

        mock_blob = MagicMock()
        mock_blob.encoding = "base64"
        mock_blob.content = base64.b64encode(b"large-blob-bytes").decode("ascii")
        self.mock_repo.get_git_blob.return_value = mock_blob

        result = self.mgr.get_image_blob("large-image.png")
        self.assertIsNotNone(result)
        raw_bytes, ct = result
        self.assertEqual(raw_bytes, b"large-blob-bytes")
        self.assertEqual(ct, "image/png")
        self.mock_repo.get_git_blob.assert_called_with("blobsha999")

    def test_get_image_blob_not_found(self):
        self.mock_repo.get_contents.side_effect = GithubException(404, {"message": "Not Found"})
        result = self.mgr.get_image_blob("nonexistent.jpg")
        self.assertIsNone(result)

    def test_get_image_blob_invalid_filename(self):
        result = self.mgr.get_image_blob("../../secret.png")
        self.assertIsNone(result)
        self.mock_repo.get_contents.assert_not_called()



class BallotApiViewsUnitTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        config = get_shareabouts_config()
        self.api = ShareaboutsApi(config, self.factory.get('/'))
        ballot_cfg = (config.get('ballot') if hasattr(config, 'get') else {}) or {}
        self.manager_group = ballot_cfg.get('manager_group') or 'admin'

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_unauthenticated_request_returns_401(self, mock_current_user):
        mock_current_user.return_value = None
        req = self.factory.get('/admin/ballot/proposals/', HTTP_ACCEPT='application/json')
        resp = ballot_proposals_api(req)
        self.assertEqual(resp.status_code, 401)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_unauthorized_request_returns_403(self, mock_current_user):
        mock_current_user.return_value = {
            'username': 'normal_user',
            'groups': [{'name': 'other_group', 'dataset': self.api.dataset_root}],
        }
        req = self.factory.get('/admin/ballot/proposals/', HTTP_ACCEPT='application/json')
        resp = ballot_proposals_api(req)
        self.assertEqual(resp.status_code, 403)

    @patch('sa_admin.views.GitHubContentManager.get_ballot_state')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_authenticated_get_proposals_returns_200(self, mock_current_user, mock_get_state):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_get_state.return_value = {
            'head_sha': 'h123',
            'tree_sha': 't123',
            'proposals': [{'slug': 'prop1'}],
            'files': {},
        }
        req = self.factory.get('/admin/ballot/proposals/', HTTP_ACCEPT='application/json')
        resp = ballot_proposals_api(req)
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['head_sha'], 'h123')
        self.assertEqual(len(data['proposals']), 1)

    @patch('sa_admin.views.GitHubContentManager.commit_proposal_changes')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_authenticated_save_proposal_returns_200(self, mock_current_user, mock_commit):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_commit.return_value = {
            'status': 'success',
            'commit_sha': 'c123',
            'tree_sha': 't123',
            'head_sha': 'c123',
        }
        payload = {
            'base_sha': 'basesha123',
            'slug': 'test-prop',
            'info': {'amount': 300000},
            'translations': {
                'en': {
                    'title': 'New Title',
                    'image_alt': 'New Alt',
                    'content': 'New Body',
                }
            },
        }
        req = self.factory.post(
            '/admin/ballot/proposals/save/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
        )
        resp = ballot_proposal_save_api(req)
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertEqual(data['commit_sha'], 'c123')

    @patch('sa_admin.views.GitHubContentManager.commit_proposal_changes')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_authenticated_save_proposal_multiple_translations(self, mock_current_user, mock_commit):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_commit.return_value = {
            'status': 'success',
            'commit_sha': 'c456',
            'head_sha': 'c456',
        }
        payload = {
            'base_sha': 'basesha123',
            'slug': 'test-prop',
            'info': {'amount': 300000, 'last_updated': '2026-09-29T12:00:00'},
            'translations': {
                'en': {
                    'title': 'Park Upgrades',
                    'content': 'English body',
                    'image_alt': 'Park',
                    'last_updated': '2026-09-29T12:00:00',
                },
                'es': {
                    'title': 'Mejoras en el parque',
                    'content': 'Cuerpo en español',
                    'image_alt': 'Parque',
                    'last_updated': '2026-09-29T12:00:00',
                },
            },
        }
        req = self.factory.post(
            '/admin/ballot/proposals/save/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
        )
        resp = ballot_proposal_save_api(req)
        self.assertEqual(resp.status_code, 200)

        mock_commit.assert_called_once()
        files_to_update = mock_commit.call_args[1]['files_to_update']
        self.assertTrue(any(k.endswith('test-prop/info.yaml') for k in files_to_update.keys()))
        self.assertTrue(any(k.endswith('test-prop/en.md') for k in files_to_update.keys()))
        self.assertTrue(any(k.endswith('test-prop/es.md') for k in files_to_update.keys()))
        info_content = next(v for k, v in files_to_update.items() if k.endswith('test-prop/info.yaml'))
        en_content = next(v for k, v in files_to_update.items() if k.endswith('test-prop/en.md'))
        es_content = next(v for k, v in files_to_update.items() if k.endswith('test-prop/es.md'))
        self.assertIn('Park Upgrades', en_content)
        self.assertIn('Mejoras en el parque', es_content)
        self.assertNotIn('last_updated', info_content)
        self.assertNotIn('last_updated', en_content)
        self.assertNotIn('last_updated', es_content)

    @patch('sa_admin.views.GitHubContentManager.commit_proposal_changes')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_save_proposal_conflict_returns_409(self, mock_current_user, mock_commit):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_commit.side_effect = GitConflictError(
            'Conflict detected',
            head_sha='newhead',
            tree_sha='newtree',
            conflicting_files={'path': {'sha': 's'}},
        )
        payload = {
            'base_sha': 'stalesha',
            'slug': 'test-prop',
            'info': {'amount': 100},
        }
        req = self.factory.post(
            '/admin/ballot/proposals/save/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
        )
        resp = ballot_proposal_save_api(req)
        self.assertEqual(resp.status_code, 409)
        data = json.loads(resp.content)
        self.assertEqual(data['error'], 'conflict')
        self.assertEqual(data['head_sha'], 'newhead')

    @override_settings(STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_editor_view_authenticated(self, mock_current_user):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_current_user.do_not_call_in_templates = False
        req = self.factory.get('/admin/ballot/')
        resp = ballot_editor(req)
        self.assertEqual(resp.status_code, 200)

    @patch('sa_admin.views.GitHubContentManager.commit_proposal_changes')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_delete_proposal_calls_commit_with_files_to_delete(self, mock_current_user, mock_commit):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_commit.return_value = {
            'status': 'success',
            'commit_sha': 'del123',
            'tree_sha': 'deltree123',
            'head_sha': 'del123',
        }
        payload = {
            'base_sha': 'basesha123',
            'delete_slug': 'old-proposal',
            'files_to_delete': [
                'src/flavors/cycle3/ballot/old-proposal/info.yaml',
                'src/flavors/cycle3/ballot/old-proposal/en.md',
            ],
        }
        req = self.factory.post(
            '/admin/ballot/proposals/save/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
        )
        resp = ballot_proposal_save_api(req)
        self.assertEqual(resp.status_code, 200)
        mock_commit.assert_called_once()
        call_kwargs = mock_commit.call_args[1]
        self.assertEqual(call_kwargs['files_to_delete'], payload['files_to_delete'])
        self.assertEqual(call_kwargs['slug'], 'old-proposal')

    @patch('sa_admin.views.GitHubContentManager.commit_proposal_changes')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_save_proposal_api_with_original_slug(self, mock_current_user, mock_commit):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_commit.return_value = {
            'status': 'success',
            'commit_sha': 'rename123',
            'tree_sha': 'renametree123',
            'head_sha': 'rename123',
        }
        payload = {
            'base_sha': 'basesha123',
            'slug': 'new-slug',
            'original_slug': 'old-slug',
            'info': {'amount': 150000},
        }
        req = self.factory.post(
            '/admin/ballot/proposals/save/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
        )
        resp = ballot_proposal_save_api(req)
        self.assertEqual(resp.status_code, 200)
        mock_commit.assert_called_once()
        call_kwargs = mock_commit.call_args[1]
        self.assertEqual(call_kwargs['slug'], 'new-slug')
        self.assertEqual(call_kwargs['original_slug'], 'old-slug')

    @patch('sa_admin.views.GitHubContentManager.commit_proposal_changes')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_save_proposal_api_collision_returns_400(self, mock_current_user, mock_commit):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_commit.side_effect = ValueError("A proposal with slug 'existing' already exists in the repository.")
        payload = {
            'base_sha': 'basesha123',
            'slug': 'existing',
            'original_slug': 'old-slug',
            'info': {'amount': 150000},
        }
        req = self.factory.post(
            '/admin/ballot/proposals/save/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
        )
        resp = ballot_proposal_save_api(req)
        self.assertEqual(resp.status_code, 400)
        data = json.loads(resp.content)
        self.assertIn("already exists", data['error'])

    @patch('sa_admin.views.GitHubContentManager.commit_proposal_changes')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_save_proposal_api_empty_changes_returns_400(self, mock_current_user, mock_commit):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_commit.side_effect = ValueError("No changes detected; cannot create an empty commit.")
        payload = {
            'base_sha': 'basesha123',
            'slug': 'test-prop',
            'info': {'amount': 100000},
        }
        req = self.factory.post(
            '/admin/ballot/proposals/save/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
        )
        resp = ballot_proposal_save_api(req)
        self.assertEqual(resp.status_code, 400)
        data = json.loads(resp.content)
        self.assertIn("No changes detected", data['error'])


    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_image_proxy_unauthenticated_returns_401(self, mock_current_user):
        mock_current_user.return_value = None
        req = self.factory.get('/admin/ballot/images/test.jpg', HTTP_ACCEPT='application/json')
        resp = ballot_image_proxy(req, filename='test.jpg')
        self.assertEqual(resp.status_code, 401)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_image_proxy_unauthorized_returns_403(self, mock_current_user):
        mock_current_user.return_value = {
            'username': 'normal_user',
            'groups': [{'name': 'other_group', 'dataset': self.api.dataset_root}],
        }
        req = self.factory.get('/admin/ballot/images/test.jpg', HTTP_ACCEPT='application/json')
        resp = ballot_image_proxy(req, filename='test.jpg')
        self.assertEqual(resp.status_code, 403)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_image_proxy_non_get_returns_405(self, mock_current_user):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        req = self.factory.post('/admin/ballot/images/test.jpg')
        resp = ballot_image_proxy(req, filename='test.jpg')
        self.assertEqual(resp.status_code, 405)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_image_proxy_invalid_filename_returns_403(self, mock_current_user):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        req = self.factory.get('/admin/ballot/images/../test.jpg')
        resp = ballot_image_proxy(req, filename='../test.jpg')
        self.assertEqual(resp.status_code, 403)

    @patch('sa_admin.views.finders.find')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_image_proxy_local_disk_hit(self, mock_current_user, mock_find):
        import tempfile
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        with tempfile.NamedTemporaryFile(suffix='.jpg') as f:
            f.write(b"local-image-data")
            f.flush()
            mock_find.return_value = f.name
            req = self.factory.get('/admin/ballot/images/local-prop.jpg')
            resp = ballot_image_proxy(req, filename='local-prop.jpg')
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp['Cache-Control'], 'public, max-age=3600')
            self.assertEqual(resp['Content-Type'], 'image/jpeg')

    @patch('sa_admin.views.GitHubContentManager.get_image_blob')
    @patch('sa_admin.views.finders.find')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_image_proxy_github_fallback_hit(self, mock_current_user, mock_find, mock_get_blob):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_find.return_value = None
        mock_get_blob.return_value = (b"github-blob-bytes", "image/png")

        req = self.factory.get('/admin/ballot/images/remote-only.png')
        resp = ballot_image_proxy(req, filename='remote-only.png')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b"github-blob-bytes")
        self.assertEqual(resp['Content-Type'], 'image/png')
        self.assertEqual(resp['Cache-Control'], 'public, max-age=3600')

    @patch('sa_admin.views.GitHubContentManager.get_image_blob')
    @patch('sa_admin.views.finders.find')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_image_proxy_not_found_returns_404(self, mock_current_user, mock_find, mock_get_blob):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_find.return_value = None
        mock_get_blob.return_value = None

        req = self.factory.get('/admin/ballot/images/missing.jpg')
        resp = ballot_image_proxy(req, filename='missing.jpg')
        self.assertEqual(resp.status_code, 404)

    def test_get_private_key_str_formats(self):
        pem_content = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----\n"
        # 1. Plain multiline string
        mgr1 = GitHubContentManager(
            owner='test', repo='repo', branch='main', flavor='cycle3',
            app_id='123', installation_id='456', private_key=pem_content,
        )
        self.assertEqual(mgr1._get_private_key_str(), pem_content)

        # 2. Escaped newlines (e.g. from single-line environment variable)
        escaped_pem = "-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA0...\\n-----END RSA PRIVATE KEY-----\\n"
        mgr2 = GitHubContentManager(
            owner='test', repo='repo', branch='main', flavor='cycle3',
            app_id='123', installation_id='456', private_key=escaped_pem,
        )
        self.assertEqual(mgr2._get_private_key_str(), pem_content)

        # 3. Base64 encoded string
        b64_pem = base64.b64encode(pem_content.encode('utf-8')).decode('ascii')
        mgr3 = GitHubContentManager(
            owner='test', repo='repo', branch='main', flavor='cycle3',
            app_id='123', installation_id='456', private_key=b64_pem,
        )
        self.assertEqual(mgr3._get_private_key_str(), pem_content)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_translate_api_unauthenticated_returns_401(self, mock_current_user):
        mock_current_user.return_value = None
        req = self.factory.post('/admin/ballot/translate/', data=json.dumps({'target_language': 'es'}), content_type='application/json', HTTP_ACCEPT='application/json')
        resp = ballot_translate_api(req)
        self.assertEqual(resp.status_code, 401)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_translate_api_unauthorized_returns_403(self, mock_current_user):
        mock_current_user.return_value = {
            'username': 'normal_user',
            'groups': [{'name': 'other_group', 'dataset': self.api.dataset_root}],
        }
        req = self.factory.post('/admin/ballot/translate/', data=json.dumps({'target_language': 'es'}), content_type='application/json', HTTP_ACCEPT='application/json')
        resp = ballot_translate_api(req)
        self.assertEqual(resp.status_code, 403)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_translate_api_non_post_returns_405(self, mock_current_user):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        req = self.factory.get('/admin/ballot/translate/')
        resp = ballot_translate_api(req)
        self.assertEqual(resp.status_code, 405)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_translate_api_missing_target_language_returns_400(self, mock_current_user):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        req = self.factory.post('/admin/ballot/translate/', data=json.dumps({'title': 'Hello'}), content_type='application/json')
        resp = ballot_translate_api(req)
        self.assertEqual(resp.status_code, 400)
        data = json.loads(resp.content)
        self.assertIn('target_language', data['error'])

    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_translate_api_missing_texts_returns_400(self, mock_current_user):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        req = self.factory.post('/admin/ballot/translate/', data=json.dumps({'target_language': 'es'}), content_type='application/json')
        resp = ballot_translate_api(req)
        self.assertEqual(resp.status_code, 400)
        data = json.loads(resp.content)
        self.assertIn('No text provided', data['error'])

    @patch('sa_admin.views.GoogleTranslationService.translate_dict')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_translate_api_success(self, mock_current_user, mock_translate_dict):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_translate_dict.return_value = {
            'title': 'Mejoras en el parque',
            'content': 'Nuevo parque',
        }
        payload = {
            'target_language': 'es',
            'title': 'Park Improvements',
            'content': 'New park',
        }
        req = self.factory.post('/admin/ballot/translate/', data=json.dumps(payload), content_type='application/json')
        resp = ballot_translate_api(req)
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['target_language'], 'es')
        self.assertEqual(data['translations']['title'], 'Mejoras en el parque')

    @patch('sa_admin.views.GoogleTranslationService.translate_dict')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_ballot_translate_api_service_error_returns_502(self, mock_current_user, mock_translate_dict):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': self.manager_group, 'dataset': self.api.dataset_root}],
        }
        mock_translate_dict.side_effect = RuntimeError("Upstream API error")
        payload = {
            'target_language': 'es',
            'title': 'Park Improvements',
        }
        req = self.factory.post('/admin/ballot/translate/', data=json.dumps(payload), content_type='application/json')
        resp = ballot_translate_api(req)
        self.assertEqual(resp.status_code, 502)
        data = json.loads(resp.content)
        self.assertIn("Upstream API error", data['error'])


class GoogleTranslationServiceUnitTests(SimpleTestCase):
    def setUp(self):
        self.mock_client = MagicMock()
        self.service = GoogleTranslationService(api_key="test-api-key", project_id="test-project", client=self.mock_client)

    def test_translate_texts_empty_list(self):
        result = self.service.translate_texts([], target_language="es")
        self.assertEqual(result, [])
        self.mock_client.translate.assert_not_called()

    def test_translate_texts_empty_strings_preserved(self):
        result = self.service.translate_texts(["", "   "], target_language="es")
        self.assertEqual(result, ["", "   "])
        self.mock_client.translate.assert_not_called()

    def test_translate_texts_success_with_html_unescaping(self):
        self.mock_client.translate.return_value = [
            {"translatedText": "Mejoras en el parque"},
            {"translatedText": "Hospital de Ni&#39;os &amp; Centro"},
        ]

        result = self.service.translate_texts(
            ["Park Improvements", "Children's Hospital & Center"],
            target_language="es",
        )
        self.assertEqual(result, ["Mejoras en el parque", "Hospital de Ni'os & Centro"])
        self.mock_client.translate.assert_called_once_with(
            ["Park Improvements", "Children's Hospital & Center"],
            target_language="es",
            source_language="en",
            format_="text",
        )

    def test_translate_texts_request_exception_raises_runtime_error(self):
        self.mock_client.translate.side_effect = RuntimeError("API connection failure")

        with self.assertRaises(RuntimeError) as cm:
            self.service.translate_texts(["Hello"], target_language="es")
        self.assertIn("Google Cloud Translation failed", str(cm.exception))

    def test_translate_dict_success(self):
        with patch.object(self.service, "translate_texts", return_value=["Hola", "Mundo"]):
            res = self.service.translate_dict({"title": "Hello", "content": "World"}, target_language="es")
            self.assertEqual(res, {"title": "Hola", "content": "Mundo"})

    @patch("sa_admin.translation.translate.Client")
    @patch("sa_admin.translation.google.auth.api_key.Credentials")
    def test_get_client_with_api_key(self, mock_api_key_creds, mock_client_cls):
        svc = GoogleTranslationService(api_key="my-key")
        client = svc.get_client()
        mock_api_key_creds.assert_called_once_with("my-key")
        mock_client_cls.assert_called_once_with(credentials=mock_api_key_creds.return_value)
        self.assertEqual(client, mock_client_cls.return_value)

    @patch("sa_admin.translation.translate.Client")
    @patch("sa_admin.translation.google.auth.default")
    def test_get_client_with_adc(self, mock_auth_default, mock_client_cls):
        mock_creds = MagicMock()
        mock_auth_default.return_value = (mock_creds, "default-proj")
        svc = GoogleTranslationService(api_key=None, project_id="poepublic-shareabouts")
        client = svc.get_client()
        mock_creds.with_quota_project.assert_called_once_with("poepublic-shareabouts")
        mock_client_cls.assert_called_once_with(credentials=mock_creds.with_quota_project.return_value)
        self.assertEqual(client, mock_client_cls.return_value)

    @patch("sa_admin.translation.google.auth.default")
    def test_get_client_missing_credentials_raises_value_error(self, mock_auth_default):
        from google.auth.exceptions import DefaultCredentialsError
        mock_auth_default.side_effect = DefaultCredentialsError("No credentials")
        svc = GoogleTranslationService(api_key=None)
        with self.assertRaises(ValueError) as cm:
            svc.get_client()
        self.assertIn("credentials not configured", str(cm.exception))



