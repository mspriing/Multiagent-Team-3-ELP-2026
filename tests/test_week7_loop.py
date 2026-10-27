"""Week 7 fixture checks for the two graph routes and bounded extra research."""
import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "team2_week4.py"


class TestWeek7Loop(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous_cwd = Path.cwd()
        os.chdir(self.temp.name)
        os.environ["TAVILY_API_KEY"] = "fixture-only"
        os.environ["DEEPSEEK_API_KEY"] = "fixture-only"
        spec = importlib.util.spec_from_file_location("week7_fixture_app", APP)
        self.module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.module
        spec.loader.exec_module(self.module)
        self.app = vars(self.module)
        self.globals = self.app["build_week7_graph"].__globals__
        self.old = self.record("Old", "https://example.test/old")
        self.new = self.record("New", "https://example.test/new")

    def tearDown(self):
        os.chdir(self.previous_cwd)
        del sys.modules["week7_fixture_app"]
        self.temp.cleanup()

    @staticmethod
    def record(claim, url):
        return {"claim": claim, "source": "Fixture", "url": url,
                "publication_date": None, "source_type": "web", "evidence": claim,
                "confidence": "high", "related_company": None, "report_section": None}

    def state(self):
        return {"question": "Original question", "assignments": [],
                "specialist_results": [], "evidence_records": [], "report": {},
                "report_markdown": "", "report_id": 0, "review": {},
                "initial_review": {}, "final_report_markdown": "",
                "revision_performed": False, "gap_check": {},
                "additional_research_performed": False, "new_evidence_count": 0}

    def wire(self, gap):
        calls = []

        def supervise(state):
            calls.append(("supervise", state["question"]))
            return {"assignments": [{"agent": "Fixture"}]}

        def specialists(state):
            calls.append(("specialists", state["question"]))
            return {"specialist_results": [{"question": state["question"]}]}

        def evidence(state):
            calls.append(("evidence", state["question"]))
            return {"evidence_records": [self.old] if state["question"] == "Original question" else [self.old, self.new]}

        def synthesis(state):
            calls.append(("synthesis", state["question"], len(state["evidence_records"])))
            return {"report": {"ok": True}}

        def review(state):
            calls.append(("review", state["question"]))
            return {"review": {"overall_status": "PASS"}, "final_report_markdown": "reviewed"}

        self.globals.update(supervisor_node=supervise, specialists_node=specialists,
                            evidence_store_node=evidence, synthesis_node=synthesis,
                            reviewer_node=review,
                            call_model_json=lambda *_: gap)
        return self.app["build_week7_graph"](), calls

    def test_adequate_evidence_skips_extra_pass(self):
        graph, calls = self.wire({"needs_research": False, "reason": "Adequate",
                                  "targeted_question": "", "conflicts": [], "gaps": []})
        result = graph.invoke(self.state())
        self.assertFalse(result["additional_research_performed"])
        self.assertEqual(result["new_evidence_count"], 0)
        self.assertEqual([name for name, *_ in calls].count("supervise"), 1)
        self.assertEqual(len(result["evidence_records"]), 1)
        self.assertEqual(calls[-2:], [("synthesis", "Original question", 1), ("review", "Original question")])

    def test_material_gap_runs_exactly_one_extra_pass_and_merges(self):
        graph, calls = self.wire({"needs_research": True, "reason": "Missing data",
                                  "targeted_question": "Targeted question", "conflicts": [],
                                  "gaps": ["Missing adoption evidence"]})
        result = graph.invoke(self.state())
        self.assertTrue(result["additional_research_performed"])
        self.assertEqual(result["new_evidence_count"], 1)
        self.assertEqual(result["evidence_records"], [self.old, self.new])
        self.assertEqual(len(result["specialist_results"]), 2)
        self.assertEqual([name for name, *_ in calls].count("supervise"), 2)
        self.assertEqual(calls[-2:], [("synthesis", "Original question", 2), ("review", "Original question")])

    def test_invalid_gap_output_fails_closed(self):
        for malformed in ({"needs_research": "true", "reason": "yes", "targeted_question": "Q",
                           "conflicts": [], "gaps": ["gap"]},
                          {"needs_research": True, "reason": "yes", "targeted_question": "Q",
                           "conflicts": [], "gaps": []},
                          {"needs_research": True, "reason": "yes", "targeted_question": "Q",
                           "conflicts": ["a", "b"], "gaps": []}):
            graph, calls = self.wire(malformed)
            result = graph.invoke(self.state())
            self.assertFalse(result["gap_check"]["needs_research"])
            self.assertEqual([name for name, *_ in calls].count("supervise"), 1)
