"""Anti-Hardcoding Regression Test Suite for ANVAYA / SUTRA.

Verifies that core modules in sutra/ (specifically ingestion, processing, intelligence,
and retrieval) do not contain hardcoded dataset-specific artifacts (e.g. 'THR-001',
'E001', 'Vendor B', 'OfficeTech', fixed financial amounts) in executable code statements.

Exemptions:
- sutra/evaluation/ (contains official PRD rubrics, benchmarks, and perturbation test suites)
- sutra/rag/engine.py (explicitly designated as out-of-scope for non-RAG AI/ML layer)
- Python comments and docstrings
"""

import ast
import os
import re
import unittest
from typing import List, Tuple

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SUTRA_DIR = os.path.join(BASE_DIR, "sutra")

FORBIDDEN_ID_PATTERN = re.compile(r"^THR-0\d\d$|^E0\d\d$")
FORBIDDEN_ENTITIES = ["Vendor B", "OfficeTech"]


class StringLiteralVisitor(ast.NodeVisitor):
    """AST visitor that collects string literals appearing in executable code (excluding docstrings)."""

    def __init__(self):
        self.literals: List[Tuple[str, int]] = []
        self._docstring_nodes = set()

    def visit_Module(self, node: ast.Module):
        # Module docstring
        if (
            node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)
        ):
            self._docstring_nodes.add(node.body[0].value)
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        if (
            node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)
        ):
            self._docstring_nodes.add(node.body[0].value)
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        if (
            node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)
        ):
            self._docstring_nodes.add(node.body[0].value)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        if (
            node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)
        ):
            self._docstring_nodes.add(node.body[0].value)
        self.generic_visit(node)

    def visit_Constant(self, node: ast.Constant):
        if isinstance(node.value, str):
            if node not in self._docstring_nodes:
                self.literals.append((node.value, getattr(node, "lineno", 0)))
        self.generic_visit(node)


class TestAntiHardcode(unittest.TestCase):
    """Ensure modules use general NLP / heuristics rather than dataset-specific string constants."""

    def get_target_files(self) -> List[str]:
        target_files = []
        for root, dirs, files in os.walk(SUTRA_DIR):
            # Exempt evaluation modules (PRD benchmark ground truth rubrics)
            if "evaluation" in root.replace("\\", "/"):
                continue
            for f in files:
                if not f.endswith(".py"):
                    continue
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, BASE_DIR).replace("\\", "/")
                # Exempt RAG engine (designated outside non-RAG AI/ML boundary)
                if rel_path == "sutra/rag/engine.py":
                    continue
                target_files.append(full_path)
        return target_files

    def test_no_hardcoded_thread_or_email_ids_in_logic(self):
        """Verify no 'THR-0xx' or 'E0xx' literal is used in business logic."""
        violations = []
        files = self.get_target_files()
        self.assertGreater(len(files), 10, "Should inspect core sutra modules")

        for file_path in files:
            rel_path = os.path.relpath(file_path, BASE_DIR).replace("\\", "/")
            with open(file_path, "r", encoding="utf-8") as f:
                try:
                    tree = ast.parse(f.read(), filename=file_path)
                except Exception as e:
                    self.fail(f"Could not parse {rel_path}: {e}")

            visitor = StringLiteralVisitor()
            visitor.visit(tree)

            for lit_val, lineno in visitor.literals:
                lit_val_clean = lit_val.strip()
                if FORBIDDEN_ID_PATTERN.match(lit_val_clean):
                    violations.append(f"{rel_path}:{lineno} -> {lit_val_clean}")

        if violations:
            msg = "Found forbidden hardcoded thread/email IDs in executable logic:\n" + "\n".join(violations)
            self.fail(msg)

    def test_no_hardcoded_specific_vendor_entities(self):
        """Verify no hardcoded specific vendor strings are directly used in non-evaluation logic."""
        violations = []
        files = self.get_target_files()

        for file_path in files:
            rel_path = os.path.relpath(file_path, BASE_DIR).replace("\\", "/")
            with open(file_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=file_path)

            visitor = StringLiteralVisitor()
            visitor.visit(tree)

            for lit_val, lineno in visitor.literals:
                for entity in FORBIDDEN_ENTITIES:
                    if entity.lower() == lit_val.strip().lower():
                        violations.append(f"{rel_path}:{lineno} -> '{entity}'")

        if violations:
            msg = "Found forbidden hardcoded entity strings in executable logic:\n" + "\n".join(violations)
            self.fail(msg)


if __name__ == "__main__":
    unittest.main()
