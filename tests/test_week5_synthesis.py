"""Week 5 end-to-end graph and SQLite checks with local fixture evidence."""

import json
import os
import importlib.util
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path


APP = Path(__file__).resolve().parents[1] / "team2_week4.py"


class TestWeek5Synthesis(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous_cwd = Path.cwd()
        os.chdir(self.temp.name)
        os.environ["TAVILY_API_KEY"] = "fixture-only"
        os.environ["DEEPSEEK_API_KEY"] = "fixture-only"
        spec = importlib.util.spec_from_file_location("week5_fixture_app", APP)
        self.module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.module
        spec.loader.exec_module(self.module)
        self.app = vars(self.module)
        self.globals = self.app["build_week5_graph"].__globals__

    def tearDown(self):
        os.chdir(self.previous_cwd)
        del sys.modules["week5_fixture_app"]
        self.temp.cleanup()

    def test_full_pipeline_persists_evidence_and_ten_section_report(self):
        records = [{
            "claim": "Fixture fact", "source": "Fixture source",
            "url": "https://example.test/fact", "publication_date": None,
            "source_type": "web", "evidence": "Fixture fact appears here.",
            "confidence": "high", "related_company": None,
            "report_section": None,
        }]
        calls = []

        def synthesize(system_prompt, prompt):
            calls.append((system_prompt, prompt))
            packet = json.loads(prompt.split("Shared Evidence Store (cite the evidence_id labels):\n", 1)[1])
            self.assertEqual(packet[0]["evidence_id"], "E1")
            self.assertEqual(packet[0]["url"], records[0]["url"])
            return {key: f"Fixture section [E1]" for key, _ in self.app["REPORT_SECTION_KEYS"]}

        self.globals["supervisor_node"] = lambda state: {"assignments": [{"agent": "fixture"}]}
        self.globals["specialists_node"] = lambda state: {"specialist_results": [{"agent": "fixture"}]}
        self.globals["extract_specialist_evidence"] = lambda results: records
        self.globals["call_model_json"] = synthesize
        graph = self.app["build_week5_graph"]()
        result = graph.invoke({
            "question": "Fixture question", "assignments": [],
            "specialist_results": [], "evidence_records": [],
            "report": {}, "report_markdown": "", "report_id": 0,
        })

        self.assertEqual(len(calls), 1)
        self.assertEqual(result["report_id"], 1)
        self.assertEqual(result["evidence_records"], records)
        self.assertEqual(result["report_markdown"].count("\n## "), 9)
        self.assertIn("## Sources / References", result["report_markdown"])
        self.assertIn("[E1] Fixture source", result["report_markdown"])
        with sqlite3.connect(self.app["EVIDENCE_DB"]) as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM evidence").fetchone()[0], 1)
            saved = conn.execute(
                "SELECT question, report_markdown, evidence_count, created_at FROM reports"
            ).fetchone()
        self.assertEqual(saved[:3], ("Fixture question", result["report_markdown"], 1))
        self.assertIn("+00:00", saved[3])

    def test_no_report_saved_without_evidence(self):
        with self.assertRaisesRegex(ValueError, "No shared evidence"):
            self.app["synthesis_node"]({"question": "Fixture question", "evidence_records": []})
        self.assertEqual(self.app["load_reports"](), [])


if __name__ == "__main__":
    unittest.main()
