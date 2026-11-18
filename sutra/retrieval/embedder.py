"""Embedding generator interfaces and implementations for dense semantic retrieval.

Provides:
- BaseEmbedder: Abstract interface for text and batch embedding generation.
- PretrainedSemanticEmbedder: Production pretrained dense embedding using sentence-transformers
  or local Hugging Face checkpoints when the library is installed.
- OllamaEmbedder: Pluggable HTTP client for local Ollama embedding models (e.g., nomic-embed-text).
- DenseFeatureEmbedder: Offline zero-dependency baseline embedder producing L2-normalized 384-dim
  vectors using subword n-gram feature hashing and term frequency projections.
  NOTE: This is an offline structural baseline, NOT a genuine pretrained language model.
- MockEmbedder: Lightweight deterministic mock for testing.
- get_embedder: Factory returning the configured or best available embedder with observable logging.
"""

from __future__ import annotations
import abc
import os
import hashlib
import re
import math
import logging
from typing import List, Optional, Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


class BaseEmbedder(abc.ABC):
    """Abstract base class for all SUTRA embedding models."""

    @property
    @abc.abstractmethod
    def dimension(self) -> int:
        """Return the fixed embedding dimension."""
        pass

    @property
    def model_type(self) -> str:
        """Return the descriptive model category ('pretrained', 'ollama', 'feature_baseline', 'mock')."""
        return "unknown"

    @abc.abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Embed a single text string into a normalized dense vector."""
        pass

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of text strings in batch. Subclasses can optimize vectorization."""
        return [self.embed_text(t) for t in texts]


class MockEmbedder(BaseEmbedder):
    """Deterministic mock embedder for tests and CI environments."""

    def __init__(self, dim: int = 64):
        self._dim = dim

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def model_type(self) -> str:
        return "mock"

    def embed_text(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * self._dim
        seed = int(hashlib.md5(text.encode("utf-8")).hexdigest()[:8], 16)
        rng = np.random.RandomState(seed)
        vec = rng.randn(self._dim).astype(np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()


class DenseFeatureEmbedder(BaseEmbedder):
    """
    Offline zero-dependency feature embedder for environments without C-compilers or external models.
    Uses multi-scale token, n-gram, and subword feature projections into a 384-dimensional space
    with L2 unit normalization.
    
    IMPORTANT: This is a structural n-gram hashing baseline, NOT a true pretrained semantic model.
    It does not capture synonymy or conceptual paraphrases unless terms or subwords overlap.
    """

    def __init__(self, dimension: int = 384, cache_size: int = 5000):
        self._dimension = dimension
        self._cache: Dict[str, List[float]] = {}
        self._cache_size = cache_size

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_type(self) -> str:
        return "feature_baseline"

    def _hash_to_index_and_sign(self, token: str, seed: int) -> tuple[int, float]:
        """Hash a token with seed to a feature bucket [0, dim-1] and sign {+1.0, -1.0}."""
        h = hashlib.sha256(f"{seed}:{token}".encode("utf-8")).digest()
        idx = int.from_bytes(h[:4], "little") % self._dimension
        sign = 1.0 if (h[4] % 2 == 0) else -1.0
        return idx, sign

    def embed_text(self, text: str) -> List[float]:
        """Generate normalized dense embedding for input text."""
        if not text or not text.strip():
            return [0.0] * self._dimension

        cleaned = text.strip()
        if cleaned in self._cache:
            return self._cache[cleaned]

        vec = np.zeros(self._dimension, dtype=np.float32)

        # 1. Normalize and extract word tokens
        tokens = re.findall(r"[A-Za-z0-9_\-\.]+", cleaned.lower())
        if not tokens:
            return [0.0] * self._dimension

        # 2. Project unigrams and word bigrams
        for i, tok in enumerate(tokens):
            # Unigram feature
            idx1, sign1 = self._hash_to_index_and_sign(tok, 101)
            vec[idx1] += sign1 * 1.0

            # Subword prefix/suffix features for morphological capture
            if len(tok) >= 4:
                prefix = tok[:3]
                suffix = tok[-3:]
                p_idx, p_sign = self._hash_to_index_and_sign(f"pre:{prefix}", 202)
                s_idx, s_sign = self._hash_to_index_and_sign(f"suf:{suffix}", 303)
                vec[p_idx] += p_sign * 0.5
                vec[s_idx] += s_sign * 0.5

            # Word bigram feature
            if i + 1 < len(tokens):
                bigram = f"{tok}_{tokens[i+1]}"
                b_idx, b_sign = self._hash_to_index_and_sign(bigram, 404)
                vec[b_idx] += b_sign * 1.5

        # 3. L2 unit normalize
        norm = float(np.linalg.norm(vec))
        if norm > 1e-9:
            vec = vec / norm
        else:
            vec = np.zeros(self._dimension, dtype=np.float32)

        result = vec.tolist()
        if len(self._cache) < self._cache_size:
            self._cache[cleaned] = result
        return result

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed_text(t) for t in texts]


class OllamaEmbedder(BaseEmbedder):
    """Pluggable embedder using local Ollama REST API (e.g. nomic-embed-text, bge-m3)."""

    def __init__(self, model_name: str = "nomic-embed-text", host: str = "http://localhost:11434"):
        self.model_name = model_name
        self.host = host
        self._dim = 768  # nomic-embed-text default
        self._verified = False

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def model_type(self) -> str:
        return "ollama"

    def check_health(self) -> bool:
        """Check if local Ollama daemon is active and responding."""
        import urllib.request
        try:
            with urllib.request.urlopen(f"{self.host}/api/tags", timeout=1.5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def embed_text(self, text: str) -> List[float]:
        import urllib.request
        import json

        if not text or not text.strip():
            return [0.0] * self._dim

        url = f"{self.host}/api/embeddings"
        payload = json.dumps({"model": self.model_name, "prompt": text}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                vec = np.array(data.get("embedding", []), dtype=np.float32)
                self._dim = len(vec)
                norm = float(np.linalg.norm(vec))
                if norm > 1e-9:
                    vec = vec / norm
                else:
                    vec = np.zeros(self._dim, dtype=np.float32)
                return vec.tolist()
        except Exception as e:
            raise ConnectionError(f"Failed to connect to Ollama at {self.host} for model '{self.model_name}': {e}")


class PretrainedSemanticEmbedder(BaseEmbedder):
    """
    Genuine pretrained transformer embedding model using sentence-transformers.
    Default model: 'all-MiniLM-L6-v2' (384-dimensional dense semantic vectors).
    Loads model once into memory and supports normalized batch encoding.
    """

    _cached_instance = None
    _cached_model_name = None

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        try:
            from sentence_transformers import SentenceTransformer
            if (
                PretrainedSemanticEmbedder._cached_instance is not None
                and PretrainedSemanticEmbedder._cached_model_name == model_name
            ):
                self.model = PretrainedSemanticEmbedder._cached_instance
            else:
                self.model = SentenceTransformer(model_name)
                PretrainedSemanticEmbedder._cached_instance = self.model
                PretrainedSemanticEmbedder._cached_model_name = model_name

            self._dim = self.model.get_sentence_embedding_dimension()
        except ImportError as e:
            raise ImportError(
                "sentence-transformers is not installed in the environment. "
                "Install via: pip install sentence-transformers (or configure SUTRA_EMBEDDING_BACKEND=feature)."
            ) from e
        except Exception as e:
            raise RuntimeError(f"Failed to load sentence-transformers model '{model_name}': {e}") from e

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def model_type(self) -> str:
        return "pretrained"

    def embed_text(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * self._dim
        vec = self.model.encode(text, normalize_embeddings=True)
        return vec.tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        cleaned = [t if (t and t.strip()) else " " for t in texts]
        vecs = self.model.encode(cleaned, normalize_embeddings=True)
        # Zero out completely empty inputs
        for idx, t in enumerate(texts):
            if not t or not t.strip():
                vecs[idx] = np.zeros(self._dim, dtype=np.float32)
        return vecs.tolist()


def get_embedder(
    backend: Optional[str] = None,
    model_name: Optional[str] = None,
    dimension: int = 384,
) -> BaseEmbedder:
    """
    Factory creating the configured embedding engine with graceful, observable fallback.
    
    Backend resolution order:
    1. Explicit `backend` argument ('pretrained', 'ollama', 'feature', 'mock').
    2. Environment variable `SUTRA_EMBEDDING_BACKEND`.
    3. Auto-detection:
       - Checks if `sentence-transformers` is installed -> PretrainedSemanticEmbedder.
       - Checks if Ollama is running on localhost:11434 -> OllamaEmbedder.
       - Falls back to DenseFeatureEmbedder (offline structural baseline).
    """
    selected_backend = backend or os.environ.get("SUTRA_EMBEDDING_BACKEND", "").lower().strip()
    target_model = model_name or os.environ.get("SUTRA_EMBEDDING_MODEL")

    if selected_backend == "mock":
        return MockEmbedder(dim=dimension)

    if selected_backend == "ollama":
        m_name = target_model or "nomic-embed-text"
        embedder = OllamaEmbedder(model_name=m_name)
        if not embedder.check_health():
            logger.warning("Ollama daemon requested but unreachable at localhost:11434. Falling back to feature baseline.")
            return DenseFeatureEmbedder(dimension=dimension)
        return embedder

    if selected_backend == "pretrained":
        m_name = target_model or "all-MiniLM-L6-v2"
        try:
            return PretrainedSemanticEmbedder(model_name=m_name)
        except Exception as e:
            logger.warning("Pretrained model '%s' unavailable (%s). Falling back to feature baseline.", m_name, e)
            return DenseFeatureEmbedder(dimension=dimension)

    if selected_backend == "feature":
        return DenseFeatureEmbedder(dimension=dimension)

    # Auto-detection
    # 1. Try PretrainedSemanticEmbedder
    try:
        import sentence_transformers  # noqa: F401
        m_name = target_model or "all-MiniLM-L6-v2"
        return PretrainedSemanticEmbedder(model_name=m_name)
    except Exception:
        pass

    # 2. Try Ollama if running
    try:
        ollama_candidate = OllamaEmbedder()
        if ollama_candidate.check_health():
            return ollama_candidate
    except Exception:
        pass

    # 3. Default to zero-dependency feature baseline
    return DenseFeatureEmbedder(dimension=dimension)
