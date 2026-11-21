"""Pluggable LLM Provider interface for Conversation Intelligence with retries and structured validation."""

from __future__ import annotations
import abc
import os
import json
import time
import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class BaseLLMProvider(abc.ABC):
    """Abstract interface for LLM completions in Conversation Intelligence."""

    @abc.abstractmethod
    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Generate structured JSON response matching system prompt instructions."""
        pass


class MockLLMProvider(BaseLLMProvider):
    """Deterministic mock provider returning pre-configured or rule-synthesized JSON responses."""

    def __init__(self, canned_responses: Optional[Dict[str, Dict[str, Any]]] = None):
        self.canned_responses = canned_responses or {}
        self.call_history: List[Dict[str, str]] = []

    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        self.call_history.append({"system": system_prompt, "user": user_prompt})
        for key, resp in self.canned_responses.items():
            if key in user_prompt:
                return resp
        return {
            "summary": "Mock summary for conversation.",
            "status": "completed",
            "decisions": [],
            "actions": [],
        }


class OllamaLLMProvider(BaseLLMProvider):
    """
    Robust local Ollama client for structured extraction.
    Includes exponential backoff retries, JSON parsing repair, and configurable timeouts.
    """

    def __init__(
        self,
        model: str = "llama3.2",
        base_url: str = "http://localhost:11434",
        timeout: float = 30.0,
        max_retries: int = 3,
        backoff_factor: float = 1.5,
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor

    def check_health(self) -> bool:
        """Check if local Ollama daemon is reachable."""
        import urllib.request
        try:
            with urllib.request.urlopen(f"{self.base_url}/api/tags", timeout=1.5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        import urllib.request
        import urllib.error

        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": f"{system_prompt}\n\nUser Input:\n{user_prompt}",
            "format": "json",
            "stream": False,
        }
        data = json.dumps(payload).encode("utf-8")

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                req = urllib.request.Request(
                    url, data=data, headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    result = json.loads(resp.read().decode("utf-8"))
                    response_text = result.get("response", "{}").strip()
                    
                    # Clean potential markdown fences ```json ... ```
                    if response_text.startswith("```"):
                        lines = response_text.splitlines()
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].startswith("```"):
                            lines = lines[:-1]
                        response_text = "\n".join(lines).strip()

                    try:
                        parsed = json.loads(response_text)
                        if isinstance(parsed, dict):
                            return parsed
                        return {"result": parsed}
                    except json.JSONDecodeError as je:
                        logger.warning("Ollama returned invalid JSON on attempt %d: %s", attempt, je)
                        last_error = je

            except (urllib.error.URLError, TimeoutError, ConnectionError) as net_err:
                logger.warning(
                    "Ollama connection error on attempt %d/%d: %s",
                    attempt,
                    self.max_retries,
                    net_err,
                )
                last_error = net_err

            if attempt < self.max_retries:
                sleep_time = self.backoff_factor ** attempt
                time.sleep(sleep_time)

        raise RuntimeError(
            f"Ollama structured generation failed after {self.max_retries} attempts. Last error: {last_error}"
        )


def get_llm_provider(
    provider_name: Optional[str] = None,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
) -> BaseLLMProvider:
    """Factory creating configured LLM provider from parameters or environment."""
    p_name = provider_name or os.environ.get("LLM_PROVIDER", "mock").lower().strip()
    if p_name == "ollama":
        b_url = base_url or os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        m_name = model or os.environ.get("OLLAMA_MODEL", "llama3.2")
        provider = OllamaLLMProvider(model=m_name, base_url=b_url)
        return provider
    return MockLLMProvider()
