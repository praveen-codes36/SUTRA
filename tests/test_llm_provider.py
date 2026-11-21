"""Unit tests for pluggable LLM providers, caching, and schema-aware validation."""

import os
import json
import unittest
from unittest.mock import patch, MagicMock
from io import BytesIO
from pydantic import BaseModel, Field

from sutra.intelligence.llm_provider import (
    get_llm_provider,
    MockLLMProvider,
    GeminiLLMProvider,
    OpenAILLMProvider,
    AnthropicLLMProvider,
    OllamaLLMProvider,
)


class DummySummarySchema(BaseModel):
    summary: str
    status: str
    item_count: int = Field(default=0)


class TestLLMProviders(unittest.TestCase):
    def setUp(self):
        # Clear provider env vars
        for k in ["LLM_PROVIDER", "GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]:
            if k in os.environ:
                del os.environ[k]

    def test_factory_mock_provider(self):
        """Factory returns MockLLMProvider when provider is mock."""
        prov = get_llm_provider("mock")
        self.assertIsInstance(prov, MockLLMProvider)
        res = prov.generate_json("sys", "user")
        self.assertIn("summary", res)

    def test_factory_rejects_missing_credentials(self):
        """Factory must raise ValueError when real provider is selected without credentials."""
        with self.assertRaises(ValueError) as cm:
            get_llm_provider("gemini")
        self.assertIn("GEMINI_API_KEY", str(cm.exception))

        with self.assertRaises(ValueError) as cm2:
            get_llm_provider("openai")
        self.assertIn("OPENAI_API_KEY", str(cm2.exception))

        with self.assertRaises(ValueError) as cm3:
            get_llm_provider("anthropic")
        self.assertIn("ANTHROPIC_API_KEY", str(cm3.exception))

    def test_factory_rejects_unknown_provider(self):
        """Factory rejects unsupported provider names without falling back silently."""
        with self.assertRaises(ValueError) as cm:
            get_llm_provider("unsupported_provider_xyz")
        self.assertIn("Unsupported LLM provider", str(cm.exception))

    def test_schema_validation_success(self):
        """generate_json successfully validates against Pydantic schema."""
        canned = {"test_query": {"summary": "Valid summary", "status": "approved", "item_count": 5}}
        prov = MockLLMProvider(canned_responses=canned)
        res = prov.generate_json("sys", "test_query", schema=DummySummarySchema)
        self.assertEqual(res["summary"], "Valid summary")
        self.assertEqual(res["item_count"], 5)

    def test_schema_validation_failure_and_retry(self):
        """When provider returns invalid schema, retry occurs and eventually raises ValueError."""
        canned = {"test_bad": {"wrong_field": "Missing required fields"}}
        prov = MockLLMProvider(canned_responses=canned)
        with self.assertRaises(ValueError) as cm:
            prov.generate_json("sys", "test_bad", schema=DummySummarySchema, max_retries=1)
        self.assertIn("Failed to generate valid structured JSON", str(cm.exception))

    @patch("urllib.request.urlopen")
    def test_gemini_provider_invocation(self, mock_urlopen):
        """Gemini provider calls REST endpoint and parses candidates."""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": json.dumps({"summary": "Gemini result", "status": "ok"})}]
                    }
                }
            ]
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_response

        prov = GeminiLLMProvider(api_key="fake-key-123", enable_cache=False)
        res = prov.generate_json("sys prompt", "user query")
        self.assertEqual(res["summary"], "Gemini result")
        self.assertEqual(res["status"], "ok")

    @patch("urllib.request.urlopen")
    def test_openai_provider_invocation(self, mock_urlopen):
        """OpenAI provider calls chat completions and parses message content."""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "choices": [
                {
                    "message": {
                        "content": json.dumps({"summary": "OpenAI result", "status": "completed"})
                    }
                }
            ]
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_response

        prov = OpenAILLMProvider(api_key="fake-openai-key", enable_cache=False)
        res = prov.generate_json("sys prompt", "user query")
        self.assertEqual(res["summary"], "OpenAI result")
        self.assertEqual(res["status"], "completed")

    @patch("urllib.request.urlopen")
    def test_anthropic_provider_invocation(self, mock_urlopen):
        """Anthropic provider calls messages endpoint and parses content blocks."""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "content": [{"text": json.dumps({"summary": "Anthropic result", "status": "done"})}]
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_response

        prov = AnthropicLLMProvider(api_key="fake-anthropic-key", enable_cache=False)
        res = prov.generate_json("sys prompt", "user query")
        self.assertEqual(res["summary"], "Anthropic result")
        self.assertEqual(res["status"], "done")


if __name__ == "__main__":
    unittest.main()
