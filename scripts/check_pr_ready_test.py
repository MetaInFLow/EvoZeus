#!/usr/bin/env python3
"""Regression tests for the local PR readiness branch contract."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("check_pr_ready.py")
SPEC = importlib.util.spec_from_file_location("check_pr_ready", MODULE_PATH)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import setup failure
    raise RuntimeError(f"Cannot load {MODULE_PATH}")
CHECK_PR_READY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK_PR_READY)


class BranchContractTests(unittest.TestCase):
    def test_generated_actor_qualified_encoded_branches_are_accepted(self) -> None:
        for branch in (
            "codex/dev/20260731-alice-governance-branch_contract",
            "codex/docs/20260616-haodifan-skill-scenario_routing",
            "codex/bug/20260616-haodifan-verdict_card-runtime_report_id",
        ):
            self.assertIsNotNone(CHECK_PR_READY.BRANCH_PATTERN.fullmatch(branch), branch)

    def test_actorless_generated_branch_is_rejected_but_legacy_branch_survives(self) -> None:
        for branch in (
            "codex/docs/20260616-skill-scenario_routing",
        ):
            self.assertIsNone(CHECK_PR_READY.BRANCH_PATTERN.fullmatch(branch), branch)
        self.assertIsNotNone(
            CHECK_PR_READY.BRANCH_PATTERN.fullmatch(
                "codex/dev/20260731-governance-branch-contract"
            )
        )

    def test_branch_diagnostic_names_encoded_fields(self) -> None:
        errors: list[str] = []
        with patch.object(
            CHECK_PR_READY,
            "run_git",
            return_value="codex/docs/20260616-haodifan-skill-scenario-routing",
        ):
            CHECK_PR_READY.check_branch(errors)

        self.assertEqual(len(errors), 1)
        self.assertIn("<encoded-actor>", errors[0])
        self.assertIn("<encoded-component>", errors[0])
        self.assertIn("<encoded-summary>", errors[0])


if __name__ == "__main__":
    unittest.main()
