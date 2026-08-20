import json
from hashlib import sha256

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


class VerifyCodeUnitTests(SimpleTestCase):
    """Tests for the verify_code endpoint."""
    pass


@override_settings(DEBUG=True)
class VerifyCodeTestIntegrationTests(SimpleTestCase):
    """
    Integration tests hitting the actual URL routing via Django test Client.

    Note: sa_vote.urls is included under path('vote', ...) with no trailing
    slash, so the resolved paths are /vote/verify-code-test, /vote/verify-code,
    and /vote/unverify.
    """

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

    def test_verify_code_stub_via_url(self):
        client = Client()
        response = client.get('/vote/verify-code')
        self.assertEqual(response.status_code, 400)
