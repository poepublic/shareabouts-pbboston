import base64
import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, RequestFactory
from django.conf import settings

from sa_admin.github import GitHubContentManager, GitConflictError
from sa_admin.views import ballot_proposals_api, ballot_proposal_save_api


class GitHubContentManagerUnitTests(SimpleTestCase):
    def setUp(self):
        self.mgr = GitHubContentManager(
            owner='poepublic',
            repo='shareabouts-pbboston',
            branch='test-branch',
            flavor='cycle3',
            token='test-token',
        )

    @patch('requests.request')
    def test_get_head_sha(self, mock_req):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'object': {'sha': 'abc123commit'}}
        mock_req.return_value = mock_resp

        head_sha = self.mgr.get_head_sha()
        self.assertEqual(head_sha, 'abc123commit')
        mock_req.assert_called_with(
            'GET',
            'https://api.github.com/repos/poepublic/shareabouts-pbboston/git/refs/heads/test-branch',
            headers={'Authorization': 'Bearer test-token', 'Accept': 'application/vnd.github+json'},
            timeout=20,
        )

    @patch('requests.request')
    def test_create_blob_text_and_binary(self, mock_req):
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {'sha': 'blob123'}
        mock_req.return_value = mock_resp

        sha_text = self.mgr.create_blob('hello world', is_binary=False)
        self.assertEqual(sha_text, 'blob123')
        mock_req.assert_called_with(
            'POST',
            'https://api.github.com/repos/poepublic/shareabouts-pbboston/git/blobs',
            headers={'Authorization': 'Bearer test-token', 'Accept': 'application/vnd.github+json'},
            json={'content': 'hello world', 'encoding': 'utf-8'},
            timeout=20,
        )

        sha_bin = self.mgr.create_blob(b'binary-data', is_binary=True)
        self.assertEqual(sha_bin, 'blob123')

    @patch('requests.request')
    def test_get_ballot_state_parsing(self, mock_req):
        # 1. get_head_sha
        head_resp = MagicMock(status_code=200)
        head_resp.json.return_value = {'object': {'sha': 'headsha'}}

        # 2. get_commit
        commit_resp = MagicMock(status_code=200)
        commit_resp.json.return_value = {'tree': {'sha': 'treesha'}}

        # 3. get_tree
        tree_resp = MagicMock(status_code=200)
        tree_resp.json.return_value = {
            'tree': [
                {
                    'path': 'src/flavors/cycle3/ballot/test-prop/info.yaml',
                    'type': 'blob',
                    'sha': 'infosha',
                },
                {
                    'path': 'src/flavors/cycle3/ballot/test-prop/en.md',
                    'type': 'blob',
                    'sha': 'mdsha',
                },
            ]
        }

        # 4. get_blob for info.yaml
        blob_info_resp = MagicMock(status_code=200)
        blob_info_resp.json.return_value = {
            'content': 'amount: 250000\nimage: /static/ballot/test.png\n',
            'encoding': 'utf-8',
        }

        # 5. get_blob for en.md
        blob_md_resp = MagicMock(status_code=200)
        blob_md_resp.json.return_value = {
            'content': '---\nlanguage: en\ntitle: Test Proposal\nimage_alt: Alt text\n---\n\nTest description body.\n',
            'encoding': 'utf-8',
        }

        mock_req.side_effect = [head_resp, commit_resp, tree_resp, blob_info_resp, blob_md_resp]

        state = self.mgr.get_ballot_state()
        self.assertEqual(state['head_sha'], 'headsha')
        self.assertEqual(state['tree_sha'], 'treesha')
        self.assertEqual(len(state['proposals']), 1)

        prop = state['proposals'][0]
        self.assertEqual(prop['slug'], 'test-prop')
        self.assertEqual(prop['info']['amount'], 250000)
        self.assertEqual(prop['translations']['en']['title'], 'Test Proposal')
        self.assertEqual(prop['translations']['en']['content'], 'Test description body.')

    @patch('requests.request')
    def test_commit_proposal_changes_success(self, mock_req):
        # 1. create_blob for info.yaml
        blob_resp = MagicMock(status_code=201)
        blob_resp.json.return_value = {'sha': 'newblob1'}

        # 2. get_head_sha
        head_resp = MagicMock(status_code=200)
        head_resp.json.return_value = {'object': {'sha': 'basehead'}}

        # 3. get_commit
        commit_resp = MagicMock(status_code=200)
        commit_resp.json.return_value = {'tree': {'sha': 'basetree'}}

        # 4. create_tree
        tree_resp = MagicMock(status_code=201)
        tree_resp.json.return_value = {'sha': 'newtree'}

        # 5. create_commit
        new_commit_resp = MagicMock(status_code=201)
        new_commit_resp.json.return_value = {'sha': 'newcommit'}

        # 6. update_ref
        ref_resp = MagicMock(status_code=200)

        mock_req.side_effect = [blob_resp, head_resp, commit_resp, tree_resp, new_commit_resp, ref_resp]

        result = self.mgr.commit_proposal_changes(
            base_sha='basehead',
            files_to_update={'src/flavors/cycle3/ballot/prop1/info.yaml': 'amount: 1000'},
            slug='prop1',
            user_sso_id='user123',
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['commit_sha'], 'newcommit')

    @patch('requests.request')
    def test_commit_proposal_changes_conflict(self, mock_req):
        # 1. create_blob
        blob_resp = MagicMock(status_code=201)
        blob_resp.json.return_value = {'sha': 'newblob1'}

        # 2. get_head_sha returns moved head
        head_resp = MagicMock(status_code=200)
        head_resp.json.return_value = {'object': {'sha': 'movedhead'}}

        # 3. compare returns changed file intersecting with target_files
        compare_resp = MagicMock(status_code=200)
        compare_resp.json.return_value = {
            'files': [{'filename': 'src/flavors/cycle3/ballot/prop1/info.yaml'}]
        }

        # In _check_conflicts: get_commit, compare, get_tree, get_blob
        commit2_resp = MagicMock(status_code=200)
        commit2_resp.json.return_value = {'tree': {'sha': 'movedtree'}}

        tree2_resp = MagicMock(status_code=200)
        tree2_resp.json.return_value = {
            'tree': [{'path': 'src/flavors/cycle3/ballot/prop1/info.yaml', 'type': 'blob', 'sha': 'server_blob'}]
        }

        blob2_resp = MagicMock(status_code=200)
        blob2_resp.json.return_value = {'content': 'amount: 9999\n', 'encoding': 'utf-8'}

        mock_req.side_effect = [blob_resp, head_resp, commit2_resp, compare_resp, tree2_resp, blob2_resp]

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
        self.dataset_root = getattr(settings, 'SHAREABOUTS', {}).get('DATASET_ROOT', 'dataset_root')

    def test_unauthenticated_request_returns_401(self):
        req = self.factory.get('/admin/ballot/proposals/', HTTP_ACCEPT='application/json')
        resp = ballot_proposals_api(req)
        self.assertEqual(resp.status_code, 401)

    @patch('sa_admin.views.GitHubContentManager.get_ballot_state')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_authenticated_get_proposals_returns_200(self, mock_current_user, mock_get_state):
        mock_current_user.return_value = {
            'username': 'boston_sso:ballot_manager',
            'name': 'Boston Ballot Manager User',
            'email': 'pb@boston.gov',
            'groups': [{'name': 'admin', 'dataset': self.dataset_root}],
        }
        mock_get_state.return_value = {
            'head_sha': 'h123',
            'tree_sha': 't123',
            'proposals': [{'slug': 'prop1'}],
            'files': {},
        }
        req = self.factory.get(
            '/admin/ballot/proposals/',
            HTTP_ACCEPT='application/json',
        )
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
            'username': 'boston_sso:ballot_manager',
            'name': 'Boston Ballot Manager User',
            'email': 'pb@boston.gov',
            'groups': [{'name': 'admin', 'dataset': self.dataset_root}],
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
        )
        resp = ballot_proposal_save_api(req)
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertEqual(data['commit_sha'], 'c123')

    @patch('sa_admin.views.GitHubContentManager.commit_proposal_changes')
    @patch('sa_util.api.ShareaboutsApi.current_user')
    def test_save_proposal_conflict_returns_409(self, mock_current_user, mock_commit):
        mock_commit.side_effect = GitConflictError(
            'Conflict detected',
            head_sha='newhead',
            tree_sha='newtree',
            conflicting_files={'path': {'sha': 's'}},
        )
        mock_current_user.return_value = {
            'username': 'boston_sso:ballot_manager',
            'name': 'Boston Ballot Manager User',
            'email': 'pb@boston.gov',
            'groups': [{'name': 'admin', 'dataset': self.dataset_root}],
        }
        payload = {
            'base_sha': 'stalesha',
            'slug': 'test-prop',
            'info': {'amount': 100},
        }
        req = self.factory.post(
            '/admin/ballot/proposals/save/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        resp = ballot_proposal_save_api(req)
        self.assertEqual(resp.status_code, 409)
        data = json.loads(resp.content)
        self.assertEqual(data['error'], 'conflict')
        self.assertEqual(data['head_sha'], 'newhead')
