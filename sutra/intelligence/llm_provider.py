"""Pluggable LLM Provider interface for Conversation Intelligence with retries, caching, and structured validation (PRD §16.4)."""

from __future__ import annotations
import abc
import os
import json
import time
import hashlib
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List, Type
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")), ".cache", "llm_responses")


def _get_cache_path(cache_key: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    return os.path.join(CACHE_DIR, f"{cache_key}.json")


def _compute_cache_key(provider: str, model: str, system_prompt: str, user_prompt: str, schema_name: str = "") -> str:
    content = f"{provider}::{model}::{schema_name}::{system_prompt}::{user_prompt}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _clean_markdown_fences(text: str) -> str:
    """Clean markdown ```json ... ``` code blocks from LLM output."""
    clean = text.strip()
    if clean.startswith("```"):
        lines = clean.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        clean = "\n".join(lines).strip()
    return clean


class BaseLLMProvider(abc.ABC):
    """Abstract interface for LLM completions in Conversation Intelligence."""

    def __init__(self, provider_name: str, model: str, enable_cache: bool = True):
        self.provider_name = provider_name
        self.model = model
        self.enable_cache = enable_cache
        self.last_latency_seconds: float = 0.0

    @abc.abstractmethod
    def _call_raw(self, system_prompt: str, user_prompt: str) -> str:
        """Execute raw model invocation returning raw string response."""
        pass

    def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Optional[Type[BaseModel]] = None,
        max_retries: int = 2,
    ) -> Dict[str, Any]:
        """
        Generate structured JSON matching system prompt and optional Pydantic schema.
        Handles on-disk caching, JSON cleaning, Pydantic validation, and retry with error feedback.
        """
        schema_name = schema.__name__ if schema else ""
        cache_key = _compute_cache_key(self.provider_name, self.model, system_prompt, user_prompt, schema_name)
        cache_file = _get_cache_path(cache_key)

        if self.enable_cache and os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                    logger.debug("LLM cache hit for key %s", cache_key)
                    return cached_data
            except Exception as e:
                logger.warning("Failed to read LLM cache file: %s", e)

        current_user_prompt = user_prompt
        last_error = None

        for attempt in range(max_retries + 1):
            start_t = time.perf_counter()
            raw_response = self._call_raw(system_prompt, current_user_prompt)
            self.last_latency_seconds = time.perf_counter() - start_t

            cleaned = _clean_markdown_fences(raw_response)
            try:
                parsed = json.loads(cleaned)
                if not isinstance(parsed, dict):
                    parsed = {"result": parsed}

                if schema is not None:
                    # Validate against Pydantic schema
                    schema.model_validate(parsed)

                # Successfully validated -> cache and return
                if self.enable_cache:
                    try:
                        with open(cache_file, "w", encoding="utf-8") as f:
                            json.dump(parsed, f, indent=2)
                    except Exception as e:
                        logger.warning("Failed to write LLM cache file: %s", e)

                return parsed

            except (json.JSONDecodeError, ValidationError) as err:
                last_error = err
                logger.warning(
                    "LLM response failed validation on attempt %d/%d (%s): %s",
                    attempt + 1,
                    max_retries + 1,
                    type(err).__name__,
                    err,
                )
                if attempt < max_retries:
                    # Feed error back into the prompt for next retry
                    current_user_prompt = (
                        f"{user_prompt}\n\n"
                        f"[SYSTEM RETRY NOTE: Your previous response failed validation with error: {err}. "
                        f"Please produce strictly valid JSON conforming exactly to the requested schema.]"
                    )

        raise ValueError(
            f"Failed to generate valid structured JSON matching schema {schema_name} "
            f"after {max_retries + 1} attempts. Last error: {last_error}"
        )


class MockLLMProvider(BaseLLMProvider):
    """Deterministic mock provider returning pre-configured or synthesized JSON responses."""

    def __init__(self, canned_responses: Optional[Dict[str, Dict[str, Any]]] = None):
        super().__init__(provider_name="mock", model="mock-model", enable_cache=False)
        self.canned_responses = canned_responses or {}
        self.call_history: List[Dict[str, str]] = []

    def _call_raw(self, system_prompt: str, user_prompt: str) -> str:
        self.call_history.append({"system": system_prompt, "user": user_prompt})
        for key, resp in self.canned_responses.items():
            if key in user_prompt:
                return json.dumps(resp)
        default_resp = {
            "summary": "Deterministic structured summary for conversation.",
            "status": "completed",
            "decisions": [],
            "actions": [],
        }
        return json.dumps(default_resp)


class OllamaLLMProvider(BaseLLMProvider):
    """Local Ollama provider with configurable host and timeout."""

    def __init__(
        self,
        model: str = "llama3.2",
        base_url: str = "http://localhost:11434",
        timeout: float = 30.0,
        max_retries: int = 3,
        backoff_factor: float = 1.5,
        enable_cache: bool = True,
    ):
        super().__init__(provider_name="ollama", model=model, enable_cache=enable_cache)
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor

    def check_health(self) -> bool:
        try:
            with urllib.request.urlopen(f"{self.base_url}/api/tags", timeout=1.5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def _call_raw(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": f"{system_prompt}\n\nUser Input:\n{user_prompt}",
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.0},
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

        last_err = None
        for attempt in range(1, self.max_retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    res_obj = json.loads(resp.read().decode("utf-8"))
                    return res_obj.get("response", "{}")
            except Exception as e:
                last_err = e
                if attempt < self.max_retries:
                    time.sleep(self.backoff_factor ** attempt)

        raise RuntimeError(f"Ollama connection failed after {self.max_retries} attempts: {last_err}")


class GeminiLLMProvider(BaseLLMProvider):
    """Google Gemini provider using direct REST API."""

    def __init__(
        self,
        model: str = "gemini-1.5-flash",
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        enable_cache: bool = True,
    ):
        super().__init__(provider_name="gemini", model=model, enable_cache=enable_cache)
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("Gemini provider requires GEMINI_API_KEY or GOOGLE_API_KEY environment variable.")
        self.timeout = timeout

    def _call_raw(self, system_prompt: str, user_prompt: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"System Instructions:\n{system_prompt}\n\nInput:\n{user_prompt}"}],
                }
            ],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json",
            },
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            res_obj = json.loads(resp.read().decode("utf-8"))
            candidates = res_obj.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "{}")
            return "{}"


class OpenAILLMProvider(BaseLLMProvider):
    """OpenAI provider using direct REST API."""

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
        base_url: str = "https://api.openai.com/v1",
        timeout: float = 30.0,
        enable_cache: bool = True,
    ):
        super().__init__(provider_name="openai", model=model, enable_cache=enable_cache)
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI provider requires OPENAI_API_KEY environment variable.")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _call_raw(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            res_obj = json.loads(resp.read().decode("utf-8"))
            choices = res_obj.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "{}")
            return "{}"


class AnthropicLLMProvider(BaseLLMProvider):
    """Anthropic provider using direct REST API."""

    def __init__(
        self,
        model: str = "claude-3-5-sonnet-20241022",
        api_key: Optional[str] = None,
        base_url: str = "https://api.anthropic.com/v1",
        timeout: float = 30.0,
        enable_cache: bool = True,
    ):
        super().__init__(provider_name="anthropic", model=model, enable_cache=enable_cache)
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("Anthropic provider requires ANTHROPIC_API_KEY environment variable.")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _call_raw(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.base_url}/messages"
        payload = {
            "model": self.model,
            "system": f"{system_prompt}\nYou MUST output valid JSON only.",
            "messages": [{"role": "user", "content": user_prompt}],
            "max_tokens": 4096,
            "temperature": 0.0,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
            },
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            res_obj = json.loads(resp.read().decode("utf-8"))
            content_blocks = res_obj.get("content", [])
            if content_blocks:
                return content_blocks[0].get("text", "{}")
            return "{}"


def get_llm_provider(
    provider_name: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    enable_cache: bool = True,
) -> BaseLLMProvider:
    """
    Factory creating configured LLM provider.
    Strictly enforces credentials and provider names without silent fallback.
    """
    p_name = (provider_name or os.environ.get("LLM_PROVIDER", "mock")).lower().strip()

    if p_name == "mock":
        return MockLLMProvider()
    elif p_name == "ollama":
        b_url = base_url or os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        m_name = model or os.environ.get("OLLAMA_MODEL", "llama3.2")
        return OllamaLLMProvider(model=m_name, base_url=b_url, enable_cache=enable_cache)
    elif p_name == "gemini":
        m_name = model or os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
        return GeminiLLMProvider(model=m_name, api_key=api_key, enable_cache=enable_cache)
    elif p_name == "openai":
        m_name = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        b_url = base_url or os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
        return OpenAILLMProvider(model=m_name, api_key=api_key, base_url=b_url, enable_cache=enable_cache)
    elif p_name == "anthropic":
        m_name = model or os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        b_url = base_url or os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1")
        return AnthropicLLMProvider(model=m_name, api_key=api_key, base_url=b_url, enable_cache=enable_cache)
    else:
        raise ValueError(f"Unsupported LLM provider '{p_name}'. Supported: mock, ollama, gemini, openai, anthropic")
