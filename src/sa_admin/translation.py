"""
Google Cloud Translation Service for Ballot Proposals
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Interfaces with Google Cloud Translation API v2 to provide automated
first-pass translations for Boston's threshold languages.
"""

import html
import logging
import os
import subprocess
from typing import Any, Dict, List, Optional, Tuple, Union

from django.conf import settings
import requests

logger = logging.getLogger(__name__)

TRANSLATE_API_URL = "https://translation.googleapis.com/language/translate/v2"


class GoogleTranslationService:
    """
    Service client for Google Cloud Translation API v2.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        project_id: Optional[str] = None,
        access_token: Optional[str] = None,
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
        self.access_token = (
            access_token
            or getattr(settings, "GOOGLE_TRANSLATE_ACCESS_TOKEN", None)
            or os.environ.get("GOOGLE_TRANSLATE_ACCESS_TOKEN")
        )

    def _get_auth_headers_and_params(self) -> Tuple[Dict[str, str], Dict[str, str]]:
        headers = {"Content-Type": "application/json; charset=utf-8"}
        params = {}

        if self.api_key:
            params["key"] = self.api_key
            return headers, params

        token = self.access_token
        if not token and getattr(settings, "DEBUG", False):
            # Attempt to obtain gcloud access token in local development
            try:
                res = subprocess.run(
                    ["gcloud", "auth", "print-access-token"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if res.returncode == 0:
                    token = res.stdout.strip()
            except Exception as e:
                logger.debug("Failed to get gcloud token: %s", e)

        if token:
            headers["Authorization"] = f"Bearer {token}"
            if self.project_id:
                headers["X-goog-user-project"] = self.project_id
            return headers, params

        raise ValueError(
            "Google Cloud Translation credentials not configured. "
            "Please configure GOOGLE_TRANSLATE_API_KEY or authenticate with gcloud."
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
        headers, params = self._get_auth_headers_and_params()

        payload = {
            "q": payload_queries,
            "target": target_language,
            "source": source_language,
            "format": "text",
        }

        try:
            resp = requests.post(
                TRANSLATE_API_URL,
                json=payload,
                headers=headers,
                params=params,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as e:
            logger.exception("Google Cloud Translation API request failed: %s", e)
            error_msg = str(e)
            if hasattr(e, "response") and e.response is not None:
                try:
                    err_json = e.response.json()
                    error_msg = err_json.get("error", {}).get("message", error_msg)
                except Exception:
                    pass
            raise RuntimeError(f"Google Cloud Translation failed: {error_msg}")

        translations_data = data.get("data", {}).get("translations", [])
        if len(translations_data) != len(payload_queries):
            raise RuntimeError("Unexpected number of translations returned by Google Cloud Translation.")

        result = list(texts)
        for idx, trans in zip(indices_to_translate, translations_data):
            raw_trans = trans.get("translatedText", "")
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
