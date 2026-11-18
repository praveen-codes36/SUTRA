"""Unit tests for dense semantic retrieval, embedding generation, vector indexing, and hybrid search."""

import os
import sys
import unittest
import numpy as np
from datetime import datetime

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sutra.models.retrieval import RetrievalDocument, DocumentType, RetrievalResult
from sutra.retrieval.embedder import (
    BaseEmbedder,
    DenseFeatureEmbedder,
    MockEmbedder,
    OllamaEmbedder,
    PretrainedSemanticEmbedder,
    get_embedder,
)
from sutra.retrieval.vector_index import VectorIndex
from sutra.retrieval.fusion import reciprocal_rank_fusion
from sutra.retrieval.hybrid import HybridRetriever
from sutra.models.email import Email
from sutra.models.intelligence import ThreadIntelligence, LifecycleState


class TestEmbeddingAndVectorRetrieval(unittest.TestCase):

    def setUp(self):
        self.embedder = DenseFeatureEmbedder(dimension=384)
        self.mock_embedder = MockEmbedder(dim=64)

    def test_mock_embedder_dimension_and_determinism(self):
        text = "Purchase order for CNC machine from Vendor B"
        vec1 = self.mock_embedder.embed_text(text)
        vec2 = self.mock_embedder.embed_text(text)
        self.assertEqual(len(vec1), 64)
        self.assertEqual(vec1, vec2)
        norm = np.linalg.norm(vec1)
        self.assertAlmostEqual(norm, 1.0, places=4)

    def test_dense_feature_embedder_properties(self):
        text = "CNC Turning Centre technical compliance and quotation"
        vec = self.embedder.embed_text(text)
        self.assertEqual(len(vec), 384)
        norm = np.linalg.norm(vec)
        self.assertAlmostEqual(norm, 1.0, places=4)

        # Empty string handling produces zero vector
        empty_vec = self.embedder.embed_text("")
        self.assertEqual(len(empty_vec), 384)
        self.assertEqual(sum(empty_vec), 0.0)

        # Batch embedding
        batch = self.embedder.embed_batch(["text one", "", "text three"])
        self.assertEqual(len(batch), 3)
        self.assertEqual(len(batch[0]), 384)
        self.assertEqual(sum(batch[1]), 0.0)

    def test_get_embedder_factory_and_fallback(self):
        # Explicit mock
        mock = get_embedder(backend="mock", dimension=32)
        self.assertEqual(mock.dimension, 32)
        self.assertEqual(mock.model_type, "mock")

        # Explicit feature
        feat = get_embedder(backend="feature", dimension=128)
        self.assertEqual(feat.dimension, 128)
        self.assertEqual(feat.model_type, "feature_baseline")

        # Fallback when ollama daemon is offline
        ollama_fallback = get_embedder(backend="ollama")
        self.assertIn(ollama_fallback.model_type, ["ollama", "feature_baseline"])

    def test_vector_index_add_and_search(self):
        index = VectorIndex(dimension=384)
        
        doc1 = RetrievalDocument(
            doc_id="email:E001",
            source_id="E001",
            thread_id="THR-001",
            doc_type=DocumentType.EMAIL,
            content="CNC Turning Centre specifications and requirements",
            dense_vector=self.embedder.embed_text("CNC Turning Centre specifications and requirements"),
        )
        doc2 = RetrievalDocument(
            doc_id="email:E009",
            source_id="E009",
            thread_id="THR-002",
            doc_type=DocumentType.EMAIL,
            content="Bonafide certificate fee receipt and grade card submission",
            dense_vector=self.embedder.embed_text("Bonafide certificate fee receipt and grade card submission"),
        )
        doc3 = RetrievalDocument(
            doc_id="email:E049",
            source_id="E049",
            thread_id="THR-010",
            doc_type=DocumentType.EMAIL,
            content="Campus network switch fiber optic cable cut and outage",
            dense_vector=self.embedder.embed_text("Campus network switch fiber optic cable cut and outage"),
        )

        index.add_documents([doc1, doc2, doc3])
        self.assertEqual(len(index), 3)

        # Query relevant to doc1
        q_vec = self.embedder.embed_text("CNC machine specifications")
        results = index.search(q_vec, top_k=2)

        self.assertEqual(len(results), 2)
        top_doc, score = results[0]
        self.assertEqual(top_doc.doc_id, "email:E001")
        self.assertGreater(score, 0.0)

    def test_vector_index_deduplication_and_filtering(self):
        index = VectorIndex(dimension=384)
        doc1 = RetrievalDocument(
            doc_id="email:E001",
            source_id="E001",
            thread_id="THR-001",
            doc_type=DocumentType.EMAIL,
            content="First version",
            dense_vector=self.embedder.embed_text("First version"),
        )
        doc1_updated = RetrievalDocument(
            doc_id="email:E001",
            source_id="E001",
            thread_id="THR-001",
            doc_type=DocumentType.EMAIL,
            content="Updated version",
            dense_vector=self.embedder.embed_text("Updated version"),
        )
        index.add_document(doc1)
        self.assertEqual(len(index), 1)
        index.add_document(doc1_updated)
        self.assertEqual(len(index), 1)
        self.assertEqual(index.get_document("email:E001").content, "Updated version")

        # Test filtering: filter out non-matching thread
        q_vec = self.embedder.embed_text("version")
        res = index.search(q_vec, filter_fn=lambda d: d.thread_id == "THR-001")
        self.assertEqual(len(res), 1)

        res_none = index.search(q_vec, filter_fn=lambda d: d.thread_id == "NON_EXISTENT")
        self.assertEqual(len(res_none), 0)

    def test_vector_index_edge_cases(self):
        index = VectorIndex(dimension=384)
        # Empty index search
        self.assertEqual(index.search(self.embedder.embed_text("query"), top_k=5), [])

        # Dimension mismatch
        doc_bad = RetrievalDocument(
            doc_id="email:E999",
            source_id="E999",
            thread_id="THR-999",
            doc_type=DocumentType.EMAIL,
            content="bad dim",
            dense_vector=[1.0, 2.0],  # dim 2 vs 384
        )
        with self.assertRaises(ValueError):
            index.add_document(doc_bad)

        # Empty/zero query vector returns empty results safely
        doc_ok = RetrievalDocument(
            doc_id="email:E001",
            source_id="E001",
            thread_id="THR-001",
            doc_type=DocumentType.EMAIL,
            content="good text",
            dense_vector=self.embedder.embed_text("good text"),
        )
        index.add_document(doc_ok)
        self.assertEqual(index.search([], top_k=5), [])
        self.assertEqual(index.search([0.0] * 384, top_k=5), [])
        self.assertEqual(index.search(None, top_k=5), [])

    def test_reciprocal_rank_fusion(self):
        list1 = ["doc1", "doc2", "doc3"]
        list2 = ["doc2", "doc1", "doc4"]
        fused = reciprocal_rank_fusion([list1, list2], k=60, top_n=3)

        top_ids = [d[0] for d in fused]
        self.assertIn("doc1", top_ids[:2])
        self.assertIn("doc2", top_ids[:2])
        self.assertEqual(len(fused), 3)

    def test_hybrid_retriever_typed_contract(self):
        e1 = Email(
            email_id="E001",
            thread_id="THR-001",
            sender="hod@inst.edu",
            recipients=["reg@inst.edu"],
            subject="CNC Turning Centre Quotations",
            timestamp=datetime(2025, 1, 10, 10, 0),
            body="Vendor B submitted a technical bid for 17.9 lakh INR.",
            sender_role="HOD ME",
        )
        s1 = ThreadIntelligence(
            thread_id="THR-001",
            topic="CNC Procurement",
            summary="Vendor B approved for 17.9L.",
            latest_status="Order placed",
            latest_email_id="E001",
            lifecycle_state=LifecycleState.APPROVED,
        )

        retriever = HybridRetriever(emails=[e1], summaries={"THR-001": s1}, embedder=self.embedder)

        # Test retrieve_results (Person 2 public typed contract)
        results = retriever.retrieve_results("Vendor B CNC procurement", top_k=2, mode="hybrid")
        self.assertTrue(len(results) > 0)
        self.assertIsInstance(results[0], RetrievalResult)
        self.assertEqual(results[0].retrieval_method, "hybrid_rrf")
        self.assertEqual(results[0].rank, 1)
        self.assertIn(results[0].source_id, ["E001", "THR-001"])
        self.assertEqual(results[0].thread_id, "THR-001")
        self.assertTrue(len(results[0].metadata) > 0)

        # Test invalid mode raises ValueError
        with self.assertRaises(ValueError):
            retriever.retrieve_results("query", mode="invalid_mode")

        # Test empty query returns empty list
        self.assertEqual(retriever.retrieve_results("", top_k=5), [])
        self.assertEqual(retriever.retrieve_results("   ", top_k=5), [])

        # Test backward-compatible retrieve
        matched_emails, matched_summaries = retriever.retrieve("Vendor B CNC", top_k=1)
        self.assertEqual(len(matched_emails), 1)
        self.assertEqual(matched_emails[0].email_id, "E001")
        self.assertEqual(len(matched_summaries), 1)
        self.assertEqual(matched_summaries[0].thread_id, "THR-001")

        # Test backward-compatible retrieve on empty query
        m_e, m_s = retriever.retrieve("")
        self.assertEqual(m_e, [])
        self.assertEqual(m_s, [])


if __name__ == "__main__":
    unittest.main()
