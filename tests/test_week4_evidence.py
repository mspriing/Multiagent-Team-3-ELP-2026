"""Fixture tests for the Week 4 graph; no live API calls or credentials."""

import json
import os
import runpy
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace


APP = Path(__file__).resolve().parents[1] / "team2_week4.py"
ROLES = ("Competitor", "Market", "Tech/Regulatory")


class TestWeek4Evidence(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous_cwd = Path.cwd()
        os.chdir(self.temp.name)
        os.environ["TAVILY_API_KEY"] = "fixture-only"
        os.environ["DEEPSEEK_API_KEY"] = "fixture-only"
        self.app = runpy.run_path(str(APP))
        self.globals = self.app["supervisor_node"].__globals__

    def tearDown(self):
        os.chdir(self.previous_cwd)
        self.temp.cleanup()

    def test_validation_and_case_insensitive_persistence(self):
        record = {
            "claim": "A verified fact", "source": "Source A", "url": "https://example.test/a",
            "publication_date": None, "source_type": "web", "evidence": "Verified source fact",
            "confidence": "high", "related_company": None, "report_section": None,
        }
        duplicates = [record, {**record, "claim": "a verified fact"}]
        invalid = [
            {**record, "claim": ""},
            {**record, "confidence": "certain"},
            {key: value for key, value in record.items() if key != "publication_date"},
        ]
        validated = self.app["validate_shared_evidence"](duplicates + invalid)
        self.assertEqual(len(validated), 1)
        self.app["save_evidence_records"](validated)
        self.app["save_evidence_records"]([{**record, "claim": "a verified fact"}])
        self.assertEqual(len(self.app["load_evidence_records"]()), 1)

    def test_full_graph_and_duplicate_rerun(self):
        barrier = threading.Barrier(3)
        lock = threading.Lock()
        calls = []

        class Search:
            def search(self, **kwargs):
                barrier.wait(timeout=5)
                role = kwargs["query"].split()[0]
                with lock:
                    calls.append(("search", role))
                return {"results": [{
                    "title": role + " Source", "url": "https://example.test/" + role,
                    "content": "Verified source fact for " + role + ". Use these resources before deciding.",
                    "published_date": "2026-10-01",
                }]}

        class Completions:
            def create(self, **kwargs):
                messages = kwargs["messages"]
                if "response_format" not in kwargs:
                    return self.reply("Fixture specialist brief")
                if "evidence extraction step" in messages[0]["content"]:
                    payload = json.loads(messages[1]["content"].split("\n\n")[-1])
                    with lock:
                        calls.append(("extract", payload["agent"]))
                    valid = {
                        "claim": "A fact about " + payload["agent"],
                        "source": "Model-invented source", "url": "https://wrong.test",
                        "publication_date": "invented", "source_type": "web",
                        "evidence": "Verified source fact for " + payload["agent"],
                        "confidence": "high", "related_company": None, "report_section": None,
                    }
                    return self.reply(json.dumps({"records": [
                        valid,
                        {**valid, "claim": "Unsupported", "evidence": "Passage absent from source"},
                        {**valid, "claim": "Recommendation as fact", "evidence": "Use these resources before deciding."},
                    ]}))
                return self.reply(json.dumps({"tasks": [
                    {"agent": role, "objective": role + " objective", "output_fields": ["finding"]}
                    for role in ROLES
                ]}))

            @staticmethod
            def reply(content):
                return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

        self.globals["tavily"] = Search()
        self.globals["deepseek"] = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
        initial = {"question": "Fixture question", "assignments": [],
                   "specialist_results": [], "evidence_records": []}
        for _ in range(2):
            result = self.app["week4_graph"].invoke(initial)
            self.assertEqual({x["agent"] for x in result["specialist_results"]}, set(ROLES))
            self.assertEqual(len(result["evidence_records"]), 3)
            for record in result["evidence_records"]:
                role = record["claim"].removeprefix("A fact about ")
                self.assertEqual(record["source"], role + " Source")
                self.assertEqual(record["url"], "https://example.test/" + role)
                self.assertEqual(record["publication_date"], "2026-10-01")
        self.assertEqual(len(self.app["load_evidence_records"]()), 3)
        self.assertEqual(len([x for x in calls if x[0] == "search"]), 6)
        self.assertEqual(len([x for x in calls if x[0] == "extract"]), 6)


if __name__ == "__main__":
    unittest.main()
