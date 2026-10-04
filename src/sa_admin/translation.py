"""
Google Cloud Translation Service for Ballot Proposals
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Interfaces with Google Cloud Translation API v2 via google-cloud-translate
to provide automated first-pass translations for Boston's threshold languages.
"""

import html
import logging
import os
from typing import Any, Dict, List, Optional, Union

from django.conf import settings
from google.cloud import translate_v2 as translate
import google.auth
import google.auth.api_key
from google.auth.exceptions import DefaultCredentialsError
from google.api_core.exceptions import GoogleAPIError

logger = logging.getLogger(__name__)


class GoogleTranslationService:
    """
    Service client for Google Cloud Translation API v2.
    Uses google-cloud-translate with support for:
      - API key authentication (via GOOGLE_TRANSLATE_API_KEY) for non-GCP hosting
      - Application Default Credentials (ADC) / Cloud Run service account for GCP
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        project_id: Optional[str] = None,
        client: Optional[translate.Client] = None,
    ):
        self.api_key = (
            api_key
            or getattr(settings, "GOOGLE_TRANSLATE_API_KEY", None)
            or os.environ.get("GOOGLE_TRANSLATE_API_KEY")
            or os.environ.get("GOOGLE_API_KEY")
        )
        self.project_id = (
            project_id
            or getattr(settings, "GOOGLE_TRANSLATE_PROJECT_ID", None)
            or os.environ.get("GOOGLE_TRANSLATE_PROJECT_ID")
            or os.environ.get("GOOGLE_CLOUD_PROJECT")
        )
        self._client = client

    def get_client(self) -> translate.Client:
        if self._client is not None:
            return self._client

        if self.api_key:
            creds = google.auth.api_key.Credentials(self.api_key)
            self._client = translate.Client(credentials=creds)
            return self._client

        try:
            creds, _ = google.auth.default()
            if self.project_id and hasattr(creds, "with_quota_project"):
                creds = creds.with_quota_project(self.project_id)
            self._client = translate.Client(credentials=creds)
            return self._client
        except (DefaultCredentialsError, Exception) as e:
            logger.exception("Google Cloud Translation credentials not configured: %s", e)
            raise ValueError(
                "Google Cloud Translation credentials not configured. "
                "Please configure GOOGLE_TRANSLATE_API_KEY, GOOGLE_APPLICATION_CREDENTIALS, "
                "or run on Cloud Run / authenticate with gcloud."
            )

    def translate_texts(
        self,
        texts: List[str],
        target_language: str,
        source_language: str = "en",
    ) -> List[str]:
        """
        Translates a list of strings into the target language using Google Cloud Translation API.
        Empty strings or whitespace-only strings are preserved without making API calls.
        """
        if not texts:
            return []

        # Find non-empty texts to translate
        indices_to_translate = [i for i, t in enumerate(texts) if t and t.strip()]
        if not indices_to_translate:
            return list(texts)

        payload_queries = [texts[i] for i in indices_to_translate]
        client = self.get_client()

        try:
            raw_results = client.translate(
                payload_queries,
                target_language=target_language,
                source_language=source_language,
                format_="text",
            )
        except (GoogleAPIError, Exception) as e:
            logger.exception("Google Cloud Translation API request failed: %s", e)
            raise RuntimeError(f"Google Cloud Translation failed: {e}")

        if not isinstance(raw_results, list):
            raw_results = [raw_results]

        if len(raw_results) != len(payload_queries):
            raise RuntimeError("Unexpected number of translations returned by Google Cloud Translation.")

        result = list(texts)
        for idx, trans in zip(indices_to_translate, raw_results):
            raw_trans = trans.get("translatedText", "") if isinstance(trans, dict) else str(trans)
            # Unescape HTML entities that Google Translate API v2 introduces (e.g. &#39;, &quot;, &amp;)
            result[idx] = html.unescape(raw_trans)

        return result

    def translate_dict(
        self,
        text_dict: Dict[str, str],
        target_language: str,
        source_language: str = "en",
    ) -> Dict[str, str]:
        """
        Translates a dictionary of {key: text} and returns {key: translated_text}.
        """
        keys = list(text_dict.keys())
        values = [text_dict[k] for k in keys]
        translated_values = self.translate_texts(values, target_language, source_language)
        return dict(zip(keys, translated_values))
