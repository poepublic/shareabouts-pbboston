import json
import os
from hashlib import sha256
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.http import Http404
from django.test import Client, override_settings, RequestFactory, SimpleTestCase


class NormalizePhoneNumberTests(SimpleTestCase):
    """Unit tests for the normalize_phone_number utility."""

    def test_strips_non_digits_from_phone_number(self):
        from sa_vote.views import normalize_phone_number
        result = normalize_phone_number('1', '555-123-4567')
        self.assertEqual(result, '+15551234567')

    def test_strips_plus_from_country_code(self):
        from sa_vote.views import normalize_phone_number
        result = normalize_phone_number('+1', '555-123-4567')
        self.assertEqual(result, '+15551234567')

    def test_strips_parens_and_spaces_from_phone_number(self):
        from sa_vote.views import normalize_phone_number
        result = normalize_phone_number('1', '(555) 123 4567')
        self.assertEqual(result, '+15551234567')

    def test_handles_international_country_code(self):
        from sa_vote.views import normalize_phone_number
        result = normalize_phone_number('44', '7911 123456')
        self.assertEqual(result, '+447911123456')

    def test_handles_dots_in_phone_number(self):
        from sa_vote.views import normalize_phone_number
        result = normalize_phone_number('1', '555.123.4567')
        self.assertEqual(result, '+15551234567')


@override_settings(DEBUG=True)
class VerifyCodeTestViewUnitTests(SimpleTestCase):
    """Unit tests for verify_code_test using RequestFactory (no URL routing)."""

    def test_valid_code_returns_204(self):
        from sa_vote.views import verify_code_test
        request = RequestFactory().get('/', {'code': '123456'})
        request.session = {}
        response = verify_code_test(request)
        self.assertEqual(response.status_code, 204)

    def test_valid_code_sets_voter_verified_on_session(self):
        from sa_vote.views import verify_code_test
        request = RequestFactory().get('/', {'code': '123456'})
        request.session = {}
        verify_code_test(request)
        self.assertTrue(request.session.get('voter_verified'))

    def test_valid_code_sets_voter_id_hash_on_session(self):
        from sa_vote.views import verify_code_test, normalize_phone_number
        request = RequestFactory().get('/', {'code': '123456'})
        request.session = {}
        verify_code_test(request)

        expected_id = normalize_phone_number('1', '555-123-4567')
        expected_hash = sha256(expected_id.encode('utf-8')).hexdigest()
        self.assertEqual(request.session.get('voter_id_hash'), expected_hash)

    def test_invalid_code_returns_404(self):
        from sa_vote.views import verify_code_test
        request = RequestFactory().get('/', {'code': '000000'})
        request.session = {}
        response = verify_code_test(request)
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_invalid_code_does_not_set_session(self):
        from sa_vote.views import verify_code_test
        request = RequestFactory().get('/', {'code': 'wrong'})
        request.session = {}
        verify_code_test(request)
        self.assertNotIn('voter_id_hash', request.session)
        self.assertNotIn('voter_verified', request.session)

    def test_missing_code_returns_400(self):
        from sa_vote.views import verify_code_test
        request = RequestFactory().get('/')
        request.session = {}
        response = verify_code_test(request)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)

    @override_settings(DEBUG=False)
    def test_raises_404_when_debug_is_false(self):
        from sa_vote.views import verify_code_test
        request = RequestFactory().get('/', {'code': '123456'})
        request.session = {}
        with self.assertRaises(Http404):
            verify_code_test(request)


class UnverifyViewUnitTests(SimpleTestCase):
    """Unit tests for unverify using RequestFactory (no URL routing)."""

    def test_returns_204(self):
        from sa_vote.views import unverify
        request = RequestFactory().get('/')
        request.session = {}
        response = unverify(request)
        self.assertEqual(response.status_code, 204)

    def test_clears_voter_id_hash_from_session(self):
        from sa_vote.views import unverify
        request = RequestFactory().get('/')
        request.session = {'voter_id_hash': 'abc123', 'voter_verified': True}
        unverify(request)
        self.assertNotIn('voter_id_hash', request.session)

    def test_clears_voter_verified_from_session(self):
        from sa_vote.views import unverify
        request = RequestFactory().get('/')
        request.session = {'voter_id_hash': 'abc123', 'voter_verified': True}
        unverify(request)
        self.assertNotIn('voter_verified', request.session)

    def test_is_safe_on_fresh_session(self):
        from sa_vote.views import unverify
        request = RequestFactory().get('/')
        request.session = {}
        # Should not raise
        response = unverify(request)
        self.assertEqual(response.status_code, 204)


from django.core.cache import cache
from django.contrib.auth.models import AnonymousUser


class VerifyCodeUnitTests(SimpleTestCase):
    """Tests for the verify_code endpoint using RequestFactory."""

    def setUp(self):
        self.factory = RequestFactory()
        cache.clear()

    def test_non_post_returns_405(self):
        from sa_vote.views import verify_code
        request = self.factory.get('/vote/verify-code')
        response = verify_code(request)
        self.assertEqual(response.status_code, 405)

    def test_missing_code_returns_400(self):
        from sa_vote.views import verify_code
        request = self.factory.post(
            '/vote/verify-code',
            data=json.dumps({}),
            content_type='application/json'
        )
        response = verify_code(request)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_invalid_or_expired_code_returns_404(self):
        from sa_vote.views import verify_code
        request = self.factory.post(
            '/vote/verify-code',
            data=json.dumps({'code': 'deadbeef'}),
            content_type='application/json'
        )
        response = verify_code(request)
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_valid_code_sets_session_and_returns_204(self):
        from sa_vote.views import verify_code
        cache.set('voter_code:a1b2c3', 'hashed_voter_id', timeout=1800)

        request = self.factory.post(
            '/vote/verify-code',
            data=json.dumps({'code': 'a1b2c3'}),
            content_type='application/json'
        )
        request.session = {}
        response = verify_code(request)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(request.session.get('voter_id_hash'), 'hashed_voter_id')
        self.assertTrue(request.session.get('voter_verified'))

    def test_code_is_case_insensitive_and_whitespace_stripped(self):
        from sa_vote.views import verify_code
        cache.set('voter_code:a1b2c3', 'hashed_voter_id', timeout=1800)

        request = self.factory.post(
            '/vote/verify-code',
            data=json.dumps({'code': '  A1B2C3  '}),
            content_type='application/json'
        )
        request.session = {}
        response = verify_code(request)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(request.session.get('voter_id_hash'), 'hashed_voter_id')
        self.assertTrue(request.session.get('voter_verified'))

    def test_post_form_encoded_code_supported(self):
        from sa_vote.views import verify_code
        cache.set('voter_code:123456', 'hashed_form_id', timeout=1800)

        request = self.factory.post(
            '/vote/verify-code',
            data={'code': '123456'}
        )
        request.session = {}
        response = verify_code(request)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(request.session.get('voter_id_hash'), 'hashed_form_id')
        self.assertTrue(request.session.get('voter_verified'))


class GenerateCodeUnitTests(SimpleTestCase):
    """Tests for the /vote/generate-code endpoint."""

    def setUp(self):
        self.factory = RequestFactory()
        cache.clear()

    def test_non_post_returns_405(self):
        from sa_vote.views import generate_code
        request = self.factory.get('/vote/generate-code')
        response = generate_code(request)
        self.assertEqual(response.status_code, 405)

    def test_missing_phone_number_returns_400(self):
        from sa_vote.views import generate_code
        request = self.factory.post(
            '/vote/generate-code',
            data=json.dumps({}),
            content_type='application/json'
        )
        response = generate_code(request)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_invalid_phone_number_returns_400(self):
        from sa_vote.views import generate_code
        request = self.factory.post(
            '/vote/generate-code',
            data=json.dumps({'phone_number': 'no-digits-here'}),
            content_type='application/json'
        )
        response = generate_code(request)
        self.assertEqual(response.status_code, 400)

    @patch('sa_util.api.ShareaboutsApi.get')
    def test_already_voted_phone_number_returns_400(self, mock_get):
        from sa_vote.views import generate_code
        mock_get.return_value = {'length': 1, 'results': [{'id': 10}]}

        request = self.factory.post(
            '/vote/generate-code',
            data=json.dumps({'phone_number': '555-123-4567'}),
            content_type='application/json'
        )
        response = generate_code(request)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('already been submitted', data.get('error', ''))

    @patch('sa_util.api.ShareaboutsApi.get')
    def test_upstream_api_failure_returns_502(self, mock_get):
        from sa_vote.views import generate_code
        mock_get.side_effect = Exception('Upstream timeout')

        request = self.factory.post(
            '/vote/generate-code',
            data=json.dumps({'phone_number': '555-123-4567'}),
            content_type='application/json'
        )
        response = generate_code(request)
        self.assertEqual(response.status_code, 502)

    @patch('sa_vote.views.send_verification_sms')
    @patch('sa_util.api.ShareaboutsApi.get')
    def test_successful_generation_stores_in_cache_and_sends_sms(self, mock_get, mock_sms):
        from sa_vote.views import generate_code, normalize_phone_number
        mock_get.return_value = {'length': 0, 'results': []}

        request = self.factory.post(
            '/vote/generate-code',
            data=json.dumps({'phone_number': '555-123-4567', 'country_code': '1'}),
            content_type='application/json'
        )
        response = generate_code(request)
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.content)
        self.assertEqual(data.get('status'), 'success')

        # Verify SMS was dispatched
        mock_sms.assert_called_once()
        sent_phone, sent_code = mock_sms.call_args[0]
        self.assertEqual(sent_phone, '+15551234567')
        self.assertEqual(len(sent_code), 6)

        # Verify cache has voter_code mapped to hashed phone
        expected_hash = sha256('+15551234567'.encode('utf-8')).hexdigest()
        self.assertEqual(cache.get(f'voter_code:{sent_code}'), expected_hash)

    @patch('sa_vote.views.send_verification_sms')
    @patch('sa_util.api.ShareaboutsApi.get')
    def test_twilio_failure_returns_502(self, mock_get, mock_sms):
        from sa_vote.views import generate_code
        mock_get.return_value = {'length': 0, 'results': []}
        mock_sms.side_effect = Exception('Twilio authentication failed')

        request = self.factory.post(
            '/vote/generate-code',
            data=json.dumps({'phone_number': '555-123-4567'}),
            content_type='application/json'
        )
        response = generate_code(request)
        self.assertEqual(response.status_code, 502)
        data = json.loads(response.content)
        self.assertIn('Failed to send verification SMS', data.get('error', ''))


class AdminGenerateCodeUnitTests(SimpleTestCase):
    """Tests for the /vote/admin/generate-code endpoint."""

    def setUp(self):
        self.factory = RequestFactory()
        cache.clear()

    def test_non_post_returns_405(self):
        from sa_vote.views import admin_generate_code
        request = self.factory.get('/vote/admin/generate-code')
        response = admin_generate_code(request)
        self.assertEqual(response.status_code, 405)

    def test_anonymous_unauthorized_user_returns_403(self):
        from sa_vote.views import admin_generate_code
        request = self.factory.post('/vote/admin/generate-code')
        request.user = AnonymousUser()
        response = admin_generate_code(request)
        self.assertEqual(response.status_code, 403)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    @patch.dict(os.environ, {
        'SHAREABOUTS__BALLOT__VOTER_SUPPORT_GROUP': 'voter_support_admin',
    })
    @override_settings(SHAREABOUTS={
        **settings.SHAREABOUTS,
        'DATASET_ROOT': 'http://localtest/api/v2/testowner/datasets/testdataset',
    })
    def test_shareabouts_voter_support_user_generates_code(self, mock_current_user):
        from sa_vote.views import admin_generate_code
        mock_current_user.return_value = {
            'username': 'voter_support_user',
            'groups': [
                {
                    'name': 'voter_support_admin',
                    'dataset': 'http://localtest/api/v2/testowner/datasets/testdataset',
                }
            ]
        }

        request = self.factory.post('/vote/admin/generate-code')
        request.user = AnonymousUser()
        response = admin_generate_code(request)
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.content)
        code = data.get('code')
        self.assertIsNotNone(code)
        self.assertEqual(len(code), 6)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    @patch.dict(os.environ, {
        'SHAREABOUTS__BALLOT__VOTER_SUPPORT_GROUP': 'voter_support_admin',
    })
    @override_settings(SHAREABOUTS={
        **settings.SHAREABOUTS,
        'DATASET_ROOT': 'http://localtest/api/v2/testowner/datasets/testdataset',
    })
    def test_shareabouts_voter_support_user_other_dataset_returns_403(self, mock_current_user):
        from sa_vote.views import admin_generate_code
        mock_current_user.return_value = {
            'username': 'voter_support_user',
            'groups': [
                {
                    'name': 'voter_support_admin',
                    'dataset': 'http://localtest/api/v2/testowner/datasets/otherdataset',
                }
            ]
        }

        request = self.factory.post('/vote/admin/generate-code')
        request.user = AnonymousUser()
        response = admin_generate_code(request)
        self.assertEqual(response.status_code, 403)

    @patch('sa_util.api.ShareaboutsApi.current_user')
    @patch.dict(os.environ, {
        'SHAREABOUTS__BALLOT__VOTER_SUPPORT_GROUP': 'voter_support_admin',
    })
    @override_settings(SHAREABOUTS={
        **settings.SHAREABOUTS,
        'DATASET_ROOT': 'http://localtest/api/v2/testowner/datasets/testdataset',
    })
    def test_shareabouts_non_voter_support_user_returns_403(self, mock_current_user):
        from sa_vote.views import admin_generate_code
        mock_current_user.return_value = {
            'username': 'regular_user',
            'groups': [
                {
                    'name': 'other_group',
                    'dataset': 'http://localtest/api/v2/testowner/datasets/testdataset',
                }
            ]
        }

        request = self.factory.post('/vote/admin/generate-code')
        request.user = AnonymousUser()
        response = admin_generate_code(request)
        self.assertEqual(response.status_code, 403)


class SendVerificationSmsUnitTests(SimpleTestCase):
    """Unit tests for send_verification_sms helper."""

    @override_settings(TWILIO_ACCOUNT_SID='', TWILIO_AUTH_TOKEN='', TWILIO_PHONE_NUMBER='')
    def test_missing_settings_raises_improperly_configured(self):
        from sa_vote.views import send_verification_sms
        from django.core.exceptions import ImproperlyConfigured
        with self.assertRaises(ImproperlyConfigured):
            send_verification_sms('+15551234567', 'a1b2c3')

    @override_settings(TWILIO_ACCOUNT_SID='AC123', TWILIO_AUTH_TOKEN='token', TWILIO_PHONE_NUMBER='+15550000000')
    @patch('twilio.rest.Client')
    def test_calls_twilio_client_messages_create(self, mock_twilio_client):
        from sa_vote.views import send_verification_sms
        mock_instance = MagicMock()
        mock_twilio_client.return_value = mock_instance

        send_verification_sms('+15551234567', 'a1b2c3')

        mock_twilio_client.assert_called_once_with('AC123', 'token')
        mock_instance.messages.create.assert_called_once_with(
            body='Your Boston Participatory Budgeting voting login code is: a1b2c3',
            from_='+15550000000',
            to='+15551234567',
        )


@override_settings(DEBUG=True)
class VerifyCodeTestIntegrationTests(SimpleTestCase):
    """
    Integration tests hitting the actual URL routing via Django test Client.
    """

    def setUp(self):
        cache.clear()

    def test_valid_code_sets_session_via_url(self):
        client = Client()
        response = client.get('/vote/verify-code-test', {'code': '123456'})
        self.assertEqual(response.status_code, 204)
        self.assertTrue(client.session.get('voter_verified'))
        self.assertIsNotNone(client.session.get('voter_id_hash'))

    def test_invalid_code_via_url(self):
        client = Client()
        response = client.get('/vote/verify-code-test', {'code': 'bad'})
        self.assertEqual(response.status_code, 404)

    def test_unverify_clears_session_via_url(self):
        client = Client()
        # Verify first
        response = client.get('/vote/verify-code-test', {'code': '123456'})
        self.assertEqual(response.status_code, 204)
        self.assertTrue(client.session.get('voter_verified'))

        # Then unverify
        response = client.get('/vote/unverify')
        self.assertEqual(response.status_code, 204)
        self.assertIsNone(client.session.get('voter_id_hash'))
        self.assertIsNone(client.session.get('voter_verified'))

    @patch('sa_vote.views.send_verification_sms')
    @patch('sa_util.api.ShareaboutsApi.get')
    def test_generate_and_verify_code_flow_via_urls(self, mock_get, mock_sms):
        mock_get.return_value = {'length': 0, 'results': []}

        client = Client()
        gen_res = client.post(
            '/vote/generate-code',
            data=json.dumps({'phone_number': '555-987-6543'}),
            content_type='application/json'
        )
        self.assertEqual(gen_res.status_code, 201)

        # Extract generated code from mock_sms
        _, sent_code = mock_sms.call_args[0]

        # Verify code
        ver_res = client.post(
            '/vote/verify-code',
            data=json.dumps({'code': sent_code}),
            content_type='application/json'
        )
        self.assertEqual(ver_res.status_code, 204)
        self.assertTrue(client.session.get('voter_verified'))
        expected_hash = sha256('+15559876543'.encode('utf-8')).hexdigest()
        self.assertEqual(client.session.get('voter_id_hash'), expected_hash)


class ShareaboutsApiTests(SimpleTestCase):
    """Unit tests for the ShareaboutsApi client extensions."""

    def setUp(self):
        self.factory = RequestFactory()

    def test_missing_request_and_sessioninfo_raises_value_error(self):
        from sa_util.api import ShareaboutsApi
        with self.assertRaises(ValueError):
            ShareaboutsApi(dataset_root='http://example.com/owner/datasets/test/')

    def test_api_key_header_attached_to_session(self):
        from sa_util.api import ShareaboutsApi
        api = ShareaboutsApi(dataset_root='http://example.com/owner/datasets/test/', sessioninfo={}, api_key='test-key-123')
        self.assertEqual(api.session.headers.get('X-Shareabouts-Key'), 'test-key-123')

    @patch('requests.Session.get')
    def test_get_returns_json_on_200(self, mock_get):
        from sa_util.api import ShareaboutsApi
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {'key': 'value'}

        api = ShareaboutsApi(dataset_root='http://example.com/owner/datasets/test/', sessioninfo={})
        result = api.get('test-resource')
        self.assertEqual(result, {'key': 'value'})

    @patch('requests.Session.get')
    def test_get_returns_default_on_404(self, mock_get):
        from sa_util.api import ShareaboutsApi
        mock_get.return_value.status_code = 404

        api = ShareaboutsApi(dataset_root='http://example.com/owner/datasets/test/', sessioninfo={})
        result = api.get('missing-resource', default=None)
        self.assertIsNone(result)

    @patch('requests.Session.post')
    def test_create_returns_json_on_201(self, mock_post):
        from sa_util.api import ShareaboutsApi
        mock_post.return_value.status_code = 201
        mock_post.return_value.content = b'{"id": 1}'
        mock_post.return_value.json.return_value = {'id': 1}

        api = ShareaboutsApi(dataset_root='http://example.com/owner/datasets/test/', sessioninfo={})
        result = api.create('places/1/ballots', json={'data': 'test'})
        self.assertEqual(result, {'id': 1})

    @patch('requests.Session.post')
    def test_create_sets_silent_header_when_true(self, mock_post):
        from sa_util.api import ShareaboutsApi
        mock_post.return_value.status_code = 204
        mock_post.return_value.content = b''
        api = ShareaboutsApi(dataset_root='http://example.com/owner/datasets/test/', sessioninfo={})
        result = api.create('places/1/ballots', json={'data': 'test'}, silent=True)

        mock_post.assert_called_once()
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs.get('headers', {}).get('X-Shareabouts-Silent'), 'true')
        self.assertIsNone(result)


class BallotFromConfigTests(SimpleTestCase):
    """Unit tests for Ballot.from_config and slugs property."""

    def test_ballot_from_config_loads_proposals_and_slugs(self):
        from sa_vote.ballots import Ballot
        from sa_util.config import get_shareabouts_config
        config = get_shareabouts_config()
        ballot = Ballot.from_config(config)
        self.assertIn('immigration-legal-defense', ballot.slugs)
        self.assertIn('neighborhood-fresh-food', ballot.slugs)


class SubmitBallotTests(SimpleTestCase):
    """Unit and functional tests for the /vote/api/submit-ballot endpoint."""

    def setUp(self):
        self.factory = RequestFactory()
        self.valid_payload = {'proposals': ['immigration-legal-defense']}

    def test_get_request_returns_405(self):
        from sa_vote.views import submit_ballot
        request = self.factory.get('/vote/api/submit-ballot')
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_ballot(request)
        self.assertEqual(response.status_code, 405)

    def test_unverified_session_returns_403(self):
        from sa_vote.views import submit_ballot
        request = self.factory.post(
            '/vote/api/submit-ballot',
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        request.session = {}
        response = submit_ballot(request)
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_invalid_json_returns_400(self):
        from sa_vote.views import submit_ballot
        request = self.factory.post(
            '/vote/api/submit-ballot',
            data='not valid json',
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_ballot(request)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_empty_proposals_returns_400(self):
        from sa_vote.views import submit_ballot
        request = self.factory.post(
            '/vote/api/submit-ballot',
            data=json.dumps({'proposals': []}),
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_ballot(request)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_more_than_five_proposals_returns_400(self):
        from sa_vote.views import submit_ballot
        request = self.factory.post(
            '/vote/api/submit-ballot',
            data=json.dumps({'proposals': ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']}),
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_ballot(request)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_duplicate_proposals_in_payload_returns_400(self):
        from sa_vote.views import submit_ballot
        request = self.factory.post(
            '/vote/api/submit-ballot',
            data=json.dumps({'proposals': ['immigration-legal-defense', 'immigration-legal-defense']}),
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_ballot(request)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_invalid_proposal_slug_returns_400(self):
        from sa_vote.views import submit_ballot
        request = self.factory.post(
            '/vote/api/submit-ballot',
            data=json.dumps({'proposals': ['invalid-slug-xyz']}),
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_ballot(request)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn('error', data)

    @patch('sa_util.api.ShareaboutsApi.get')
    def test_duplicate_ballot_upstream_returns_409(self, mock_get):
        from sa_vote.views import submit_ballot
        mock_get.return_value = {
            'length': 1,
            'results': [{'id': 100, 'id_hash': 'test_hash'}]
        }

        request = self.factory.post(
            '/vote/api/submit-ballot',
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_ballot(request)
        self.assertEqual(response.status_code, 409)
        data = json.loads(response.content)
        self.assertIn('error', data)

    @patch('sa_util.api.ShareaboutsApi.create')
    @patch('sa_util.api.ShareaboutsApi.get')
    def test_successful_ballot_submission_returns_201_and_preserves_session(self, mock_get, mock_create):
        from sa_vote.views import submit_ballot
        mock_get.return_value = {'length': 0, 'results': []}
        mock_create.return_value = {'id': 1}

        request = self.factory.post(
            '/vote/api/submit-ballot',
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_ballot(request)

        self.assertEqual(response.status_code, 201)
        data = json.loads(response.content)
        self.assertEqual(data.get('status'), 'success')

        # Verify session is still intact for survey
        self.assertTrue(request.session.get('voter_verified'))
        self.assertEqual(request.session.get('voter_id_hash'), 'test_hash')

        # Verify payload sent to create
        mock_create.assert_called_once()
        args, kwargs = mock_create.call_args
        sent_payload = kwargs.get('json')
        self.assertEqual(sent_payload['id_hash'], 'test_hash')
        self.assertEqual(sent_payload['anonymous_proposals'], ['immigration-legal-defense'])
        self.assertIn('lang', sent_payload)


class SubmitSurveyTests(SimpleTestCase):
    """Unit and functional tests for the /vote/api/submit-survey endpoint."""

    def setUp(self):
        self.factory = RequestFactory()
        self.valid_payload = {'age': 30, 'neighborhood': 'Dorchester', 'anonymous_income': '50k-75k'}

    def test_get_request_returns_405(self):
        from sa_vote.views import submit_survey
        request = self.factory.get('/vote/api/submit-survey')
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_survey(request)
        self.assertEqual(response.status_code, 405)

    def test_unverified_session_returns_403(self):
        from sa_vote.views import submit_survey
        request = self.factory.post(
            '/vote/api/submit-survey',
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        request.session = {}
        response = submit_survey(request)
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.content)
        self.assertIn('error', data)

    def test_invalid_json_returns_400(self):
        from sa_vote.views import submit_survey
        request = self.factory.post(
            '/vote/api/submit-survey',
            data='not valid json',
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_survey(request)
        self.assertEqual(response.status_code, 400)

    @patch('sa_util.api.ShareaboutsApi.get')
    def test_duplicate_survey_upstream_returns_409(self, mock_get):
        from sa_vote.views import submit_survey
        mock_get.return_value = {
            'length': 1,
            'results': [{'id': 200, 'id_hash': 'test_hash'}]
        }

        request = self.factory.post(
            '/vote/api/submit-survey',
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_survey(request)
        self.assertEqual(response.status_code, 409)
        data = json.loads(response.content)
        self.assertIn('error', data)

    @patch('sa_util.api.ShareaboutsApi.create')
    @patch('sa_util.api.ShareaboutsApi.get')
    def test_successful_survey_submission_transforms_keys_and_invalidates_session(self, mock_get, mock_create):
        from sa_vote.views import submit_survey
        mock_get.return_value = {'length': 0, 'results': []}
        mock_create.return_value = {'id': 2}

        request = self.factory.post(
            '/vote/api/submit-survey',
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        request.session = {'voter_verified': True, 'voter_id_hash': 'test_hash'}
        response = submit_survey(request)

        self.assertEqual(response.status_code, 201)
        data = json.loads(response.content)
        self.assertEqual(data.get('status'), 'success')

        # Verify session is invalidated
        self.assertNotIn('voter_verified', request.session)
        self.assertNotIn('voter_id_hash', request.session)

        # Verify payload sent to create
        mock_create.assert_called_once()
        args, kwargs = mock_create.call_args
        sent_payload = kwargs.get('json')
        self.assertEqual(sent_payload['id_hash'], 'test_hash')
        self.assertEqual(sent_payload['anonymous_age'], 30)
        self.assertEqual(sent_payload['anonymous_neighborhood'], 'Dorchester')
        self.assertEqual(sent_payload['anonymous_income'], '50k-75k')
        self.assertIn('lang', sent_payload)


@override_settings(DEBUG=True)
class SubmitIntegrationTests(SimpleTestCase):
    """Integration tests via Django test client testing URL routing and end-to-end flows."""

    @patch('sa_util.api.ShareaboutsApi.create')
    @patch('sa_util.api.ShareaboutsApi.get')
    def test_full_ballot_and_survey_flow_via_client(self, mock_get, mock_create):
        mock_get.return_value = {'length': 0, 'results': []}
        mock_create.return_value = {'id': 1}

        client = Client()
        # Verify code first using verify-code-test
        v_res = client.get('/vote/verify-code-test', {'code': '123456'})
        self.assertEqual(v_res.status_code, 204)
        self.assertTrue(client.session.get('voter_verified'))

        # Submit ballot
        b_res = client.post(
            '/vote/api/submit-ballot',
            data=json.dumps({'proposals': ['immigration-legal-defense']}),
            content_type='application/json'
        )
        self.assertEqual(b_res.status_code, 201)
        self.assertTrue(client.session.get('voter_verified'))

        # Submit survey
        s_res = client.post(
            '/vote/api/submit-survey',
            data=json.dumps({'age': 25, 'ethnicity': ['Asian']}),
            content_type='application/json'
        )
        self.assertEqual(s_res.status_code, 201)

        # Verified session is now cleared
        self.assertIsNone(client.session.get('voter_verified'))
        self.assertIsNone(client.session.get('voter_id_hash'))
