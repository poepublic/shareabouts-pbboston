import base64
import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, RequestFactory

from sa_admin.github import GitHubContentManager, GitConflictError
from sa_admin.views import ballot_proposals_api, ballot_proposal_save_api
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


class BallotApiViewsUnitTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        config = get_shareabouts_config()
        self.api = ShareaboutsApi(config, self.factory.get('/'))

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
            'groups': [{'name': 'admin', 'dataset': self.api.dataset_root}],
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
            'groups': [{'name': 'admin', 'dataset': self.api.dataset_root}],
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
    def test_save_proposal_conflict_returns_409(self, mock_current_user, mock_commit):
        mock_current_user.return_value = {
            'username': 'ballot_admin',
            'groups': [{'name': 'admin', 'dataset': self.api.dataset_root}],
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

