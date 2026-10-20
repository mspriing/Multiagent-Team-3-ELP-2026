"""Week 6 reviewer gates and full graph checks with fixture evidence only."""

import importlib.util
from contextlib import contextmanager
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


APP = Path(__file__).resolve().parents[1] / "team2_week4.py"
SCORE_KEYS = (
    "completeness", "citation_support", "source_quality", "consistency",
    "business_usefulness", "clarity",
)


def review(scores=None, issues=None, status="PASS", gaps=None):
    return {
        "overall_status": status,
        "scores": scores if scores is not None else {key: 8 for key in SCORE_KEYS},
        "issues": issues if issues is not None else [],
        "research_gaps": gaps if gaps is not None else [],
    }


class TestWeek6Review(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous_cwd = Path.cwd()
        os.chdir(self.temp.name)
        os.environ["TAVILY_API_KEY"] = "fixture-only"
        os.environ["DEEPSEEK_API_KEY"] = "fixture-only"
        spec = importlib.util.spec_from_file_location("week6_fixture_app", APP)
        self.module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.module
        spec.loader.exec_module(self.module)
        self.app = vars(self.module)
        self.globals = self.app["build_week6_graph"].__globals__
        self.records = [{
            "claim": "Fixture fact", "source": "Fixture source",
            "url": "https://example.test/fact", "publication_date": None,
            "source_type": "web", "evidence": "Fixture fact appears here.",
            "confidence": "high", "related_company": None,
            "report_section": None,
        }]
        self.draft = {key: "Fixture fact [E1]" for key, _ in self.app["REPORT_SECTION_KEYS"]}

    def tearDown(self):
        os.chdir(self.previous_cwd)
        del sys.modules["week6_fixture_app"]
        self.temp.cleanup()

    def _state(self):
        return {
            "question": "Fixture question", "assignments": [],
            "specialist_results": [], "evidence_records": self.records,
            "report": self.draft.copy(), "report_markdown": "",
            "report_id": 0, "review": {}, "initial_review": {},
            "final_report_markdown": "", "revision_performed": False,
        }

    def _full_graph(self, responses):
        calls = []

        def model(system_prompt, prompt):
            calls.append((system_prompt, prompt))
            return responses.pop(0)

        self.globals["supervisor_node"] = lambda state: {"assignments": [{"agent": "fixture"}]}
        self.globals["specialists_node"] = lambda state: {"specialist_results": [{"agent": "fixture"}]}
        self.globals["extract_specialist_evidence"] = lambda results: self.records
        self.globals["call_model_json"] = model
        graph = self.app["build_week6_graph"]()
        result = graph.invoke({**self._state(), "evidence_records": [], "report": {}})
        return result, calls

    def test_initial_pass_keeps_draft_and_renders_ten_section_final(self):
        result, calls = self._full_graph([self.draft.copy(), review()])
        self.assertEqual(len(calls), 2)  # synthesis, then review; no revision
        self.assertEqual(result["review"]["overall_status"], "PASS")
        self.assertFalse(result["revision_performed"])
        self.assertEqual(result["report"], self.draft)
        self.assertEqual(result["final_report_markdown"].count("\n## "), 10)
        self.assertIn("# REVIEWED — Prototype-approved", result["final_report_markdown"])
        self.assertIn("[E1] Fixture source", result["final_report_markdown"])
        with sqlite3.connect(self.app["EVIDENCE_DB"]) as conn:
            saved = conn.execute("SELECT report_markdown FROM reports").fetchone()[0]
        self.assertTrue(saved.startswith("# DRAFT — Unreviewed"))

    def test_failure_then_one_revision_passes(self):
        low = review(scores={**{key: 8 for key in SCORE_KEYS}, "clarity": 6}, status="PASS")
        revised = {key: "Clearer fixture fact [E1]" for key in self.draft}
        result, calls = self._full_graph([self.draft.copy(), low, revised, review()])
        self.assertEqual(len(calls), 4)
        self.assertTrue(result["revision_performed"])
        self.assertEqual(result["initial_review"]["overall_status"], "NEEDS_REVISION")
        self.assertEqual(result["review"]["overall_status"], "PASS")
        self.assertEqual(result["report"], revised)
        self.assertEqual(set(result["report"]), {key for key, _ in self.app["REPORT_SECTION_KEYS"]})
        self.assertEqual(result["initial_review"]["scores"]["clarity"], 6)
        self.assertIn("only allowed sources", calls[2][1])

    def test_failure_after_one_revision_stays_unapproved(self):
        issue = {"category": "citation_support", "section": "executive_summary", "explanation": "[E1] does not support this claim.", "suggested_fix": "Remove the claim."}
        result, calls = self._full_graph([
            self.draft.copy(), review(issues=[issue]), self.draft.copy(), review(issues=[issue]),
        ])
        self.assertEqual(len(calls), 4)  # no third review or second revision
        self.assertEqual(result["review"]["overall_status"], "NEEDS_REVISION")
        self.assertIn("# UNAPPROVED DRAFT", result["final_report_markdown"])

    def test_missing_or_malformed_scores_fail_closed(self):
        self.globals["call_model_json"] = lambda *_: review(scores={"clarity": 8})
        with self.assertRaisesRegex(ValueError, "missing a required score"):
            self.app["review_report"]("Q", self.draft, self.records)
        self.globals["call_model_json"] = lambda *_: {"overall_status": "PASS", "scores": [], "issues": [], "research_gaps": []}
        with self.assertRaisesRegex(ValueError, "scores must be"):
            self.app["review_report"]("Q", self.draft, self.records)
        for invalid in (True, float("nan"), -1, 11, "8"):
            with self.subTest(invalid=invalid):
                self.globals["call_model_json"] = lambda *_, value=invalid: review(scores={
                    **{key: 8 for key in SCORE_KEYS}, "clarity": value,
                })
                with self.assertRaises(ValueError):
                    self.app["review_report"]("Q", self.draft, self.records)

    def test_material_citation_issue_blocks_model_pass(self):
        self.globals["call_model_json"] = lambda *_: review(issues=[
            {"category": "citation_support", "section": "executive_summary", "explanation": "Wrong citation.", "suggested_fix": "Use a supporting citation."}
        ])
        self.assertEqual(self.app["review_report"]("Q", self.draft, self.records)["overall_status"], "NEEDS_REVISION")

    def test_model_revision_request_and_malformed_issues_fail_closed(self):
        self.globals["call_model_json"] = lambda *_: review(status="NEEDS_REVISION")
        self.assertEqual(self.app["review_report"]("Q", self.draft, self.records)["overall_status"], "NEEDS_REVISION")
        self.globals["call_model_json"] = lambda *_: review(issues=[{"category": "citation_support"}])
        with self.assertRaisesRegex(ValueError, "invalid shape"):
            self.app["review_report"]("Q", self.draft, self.records)
        for malformed in (None, {}, ["gap", 3]):
            with self.subTest(malformed=malformed):
                self.globals["call_model_json"] = lambda *_, value=malformed: review(gaps=value) if value is not None else {
                    **review(), "research_gaps": None,
                }
                with self.assertRaises(ValueError):
                    self.app["review_report"]("Q", self.draft, self.records)
        self.globals["call_model_json"] = lambda *_: {**review(), "issues": "none"}
        with self.assertRaises(ValueError):
            self.app["review_report"]("Q", self.draft, self.records)

    def test_citation_issue_cannot_be_dismissed_by_freeform_minor_word(self):
        issue = {"category": "citation_support", "section": "executive_summary",
                 "explanation": "Unsupported claim; minor edits will not fix it.",
                 "suggested_fix": "Remove the claim."}
        self.globals["call_model_json"] = lambda *_: review(issues=[issue])
        self.assertEqual(self.app["review_report"]("Q", self.draft, self.records)["overall_status"], "NEEDS_REVISION")

    def test_unknown_evidence_label_blocks_model_pass(self):
        report_with_bad_label = {**self.draft, "executive_summary": "Unsupported [E99]"}
        self.globals["call_model_json"] = lambda *_: review()
        checked = self.app["review_report"]("Q", report_with_bad_label, self.records)
        self.assertEqual(checked["overall_status"], "NEEDS_REVISION")
        self.assertIn("[E99]", str(checked["issues"]))

    def test_revision_must_keep_all_sections(self):
        self.globals["call_model_json"] = lambda *_: {"executive_summary": "Only one section"}
        with self.assertRaisesRegex(ValueError, "preserve all nine"):
            self.app["revise_report_once"]("Q", self.draft, self.records, review())
        self.globals["call_model_json"] = lambda *_: None
        with self.assertRaisesRegex(ValueError, "preserve all nine"):
            self.app["revise_report_once"]("Q", self.draft, self.records, review())

    def test_review_and_revision_never_call_search(self):
        self.globals["call_model_json"] = lambda *_: review()
        with patch.object(self.app["tavily"], "search", side_effect=AssertionError("unexpected search")):
            self.app["review_report"]("Q", self.draft, self.records)
            self.globals["call_model_json"] = lambda *_: self.draft.copy()
            self.app["revise_report_once"]("Q", self.draft, self.records, review())

    def test_unapproved_report_is_rendered_only_inside_expander(self):
        events = []

        @contextmanager
        def expander(label):
            events.append(("enter", label))
            yield
            events.append(("exit", label))

        def markdown(content):
            events.append(("markdown", content))

        result = {**self._state(), "review": review(status="NEEDS_REVISION"),
                  "initial_review": review(), "revision_performed": True,
                  "final_report_markdown": "UNAPPROVED REPORT"}
        with patch.object(self.module.st, "expander", side_effect=expander), \
             patch.object(self.module.st, "markdown", side_effect=markdown), \
             patch.object(self.module.st, "dataframe"), \
             patch.object(self.module.st, "subheader"), \
             patch.object(self.module.st, "json"), \
             patch.object(self.module.st, "error"), \
             patch.object(self.module.st, "success"):
            self.app["display_week6_result"](result)
        label = "Unapproved draft — for review only"
        self.assertEqual(events[-3:], [("enter", label), ("markdown", "UNAPPROVED REPORT"), ("exit", label)])

    def test_prior_week5_graph_still_exists(self):
        self.assertIn("build_week5_graph", self.app)
        self.assertIn("week5_graph", self.app)
        self.assertTrue(self.app["render_report_markdown"](self.draft, self.records).startswith(
            "# DRAFT — Unreviewed research report"
        ))


if __name__ == "__main__":
    unittest.main()
