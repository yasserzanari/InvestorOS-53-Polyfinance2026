"""Explicit calendar units and one-branch simulations must survive validation unchanged."""
import csv
import json
import math
import os
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from pydantic import ValidationError
from fastapi import HTTPException

from investoros_api import simulation
from investoros_api.simulation import ScenarioBranch, ScenarioProjectionRequest


class SimulationUnitsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.env = patch.dict(os.environ, {"SIMULATION_DATA_DIR": str(self.root)})
        self.env.start()
        simulation._assets.cache_clear()
        self.write("assets_universe.csv", [{"ticker": "ABC", "name": "Example", "currency": "USD"}])
        self.write("corporate_actions.csv", [{"ticker": "ABC", "ex_date": "2025-01-01", "action": "dividend", "value": "0", "unit": "USD"}])
        dates = [date(2025, 1, 1) + timedelta(days=i) for i in range(260)]
        self.dates = [observed for observed in dates if observed.weekday() < 5]
        self.write("prices_daily.csv", [{"ticker": "ABC", "date": observed.isoformat(), "adj_close": "100", "volume": "100"} for observed in self.dates])
        self.write("sources_metadata.csv", [{"file": "prices_daily.csv", "source": "Yahoo Finance via yfinance", "processing": "No forward fill", "limitations": "Historical data, not certified"}])

    def tearDown(self):
        self.env.stop()
        simulation._assets.cache_clear()
        self.temp.cleanup()

    def write(self, name, rows):
        with (self.root / name).open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    def request(self, **changes):
        payload = {"ticker": "ABC", "horizonDays": 30, "branches": [{"id": "up", "title": "Hausse demandée", "event": "Hausse hypothétique", "shockPct": 10, "eventAfterDays": 10}]}
        payload.update(changes)
        return ScenarioProjectionRequest.model_validate(payload)

    def test_single_ten_percent_shock_after_ten_days_and_thirty_day_horizon_are_preserved(self):
        result = simulation.project_scenarios(self.request())
        self.assertEqual(result["timeUnit"], "calendar_days")
        self.assertEqual(result["horizonDays"], 30)
        self.assertNotIn("horizonObservations", result)
        self.assertEqual(len(result["branches"]), 1)
        branch, = result["branches"]
        self.assertEqual(branch["shockPct"], 10)
        self.assertEqual(branch["eventAfterDays"], 10)
        self.assertEqual(branch["path"][-1]["days"], 30)
        self.assertNotIn("eventAfterObservations", branch)
        self.assertEqual(result["asOf"], self.dates[-1].isoformat())
        for point in branch["path"]:
            self.assertNotIn("observations", point)
            self.assertEqual(point["medianPrice"], 100 if point["days"] < 10 else 110)
            self.assertEqual(point["eventApplied"], point["days"] >= 10)
            self.assertEqual(point["targetDate"], (self.dates[-1] + timedelta(days=point["days"])).isoformat())
            self.assertEqual(point["dateKind"], "scenario_target")
        self.assertIn(10, [point["days"] for point in branch["path"]])
        self.assertEqual(result["sourceClassification"], "observations")
        self.assertIn("jours fériés", result["method"])
        self.assertIn("aucun cours en direct", " ".join(result["limitations"]))

    def test_calendar_windows_use_next_available_quote_without_changing_requested_offset(self):
        rows = [{"ticker": "ABC", "date": observed.isoformat(), "adj_close": str(100 + i), "volume": "100"} for i, observed in enumerate(self.dates)]
        self.write("prices_daily.csv", rows)
        result = simulation.project_scenarios(self.request(horizonDays=3, branches=[{"id": "base", "title": "Sans choc", "event": "Hypothèse", "shockPct": 0, "eventAfterDays": 1}]))
        empirical = []
        for i, observed in enumerate(self.dates):
            later = next((j for j in range(i + 1, len(self.dates)) if self.dates[j] >= observed + timedelta(days=3)), None)
            if later is not None:
                empirical.append(float(rows[later]["adj_close"]) / float(rows[i]["adj_close"]) - 1)
        expected = round((100 + len(rows) - 1) * (1 + round(simulation._quantile(empirical, .5) * 100, 4) / 100), 4)
        self.assertEqual(result["branches"][0]["path"][-1]["medianPrice"], expected)
        self.assertEqual(result["horizonDays"], 3)
        self.assertEqual(result["branches"][0]["eventAfterDays"], 1)

    def test_any_observation_horizon_and_legacy_horizons_keep_old_keys(self):
        for horizon in (1, 20, 30, 60, 120):
            with self.subTest(horizon=horizon):
                request = ScenarioProjectionRequest(ticker="ABC", horizonObservations=horizon, branches=[ScenarioBranch(id="one", title="Un seul", event="Hypothèse", shockPct=10, eventAfterObservations=min(10, horizon))])
                result = simulation.project_scenarios(request)
                self.assertEqual(result["timeUnit"], "observations")
                self.assertEqual(result["horizonObservations"], horizon)
                self.assertNotIn("horizonDays", result)
                self.assertIn("eventAfterObservations", result["branches"][0])
                self.assertEqual(result["branches"][0]["path"][-1]["observations"], horizon)
                self.assertNotIn("days", result["branches"][0]["path"][-1])

    def test_units_unknown_fields_offsets_and_branch_ids_are_strict(self):
        invalid = [
            {"horizonDays": None}, {"horizonObservations": 30}, {"horizonObservations": None},
            {"unknown": True}, {"horizonDays": 0}, {"horizonDays": 121},
            {"horizonDays": 30.0}, {"horizonDays": "30"}, {"horizonDays": True},
            {"branches": []},
        ]
        for changes in invalid:
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                self.request(**changes)
        original = {"id": "one", "title": "Test", "event": "Hypothèse", "shockPct": 10, "eventAfterDays": 10}
        for changes in ({"eventAfterDays": 31}, {"eventAfterDays": -1}, {"eventAfterDays": 10.0}, {"eventAfterDays": True}, {"eventAfterDays": "10"}, {"eventAfterObservations": 10}, {"eventAfterObservations": None}, {"shockPct": math.nan}, {"shockPct": math.inf}, {"shockPct": -math.inf}, {"shockPct": True}, {"unknown": 1}):
            with self.subTest(branch=changes), self.assertRaises(ValidationError):
                self.request(branches=[{**original, **changes}])
        with self.assertRaises(ValidationError):
            self.request(branches=[original, original])
        with self.assertRaises(ValidationError):
            self.request(branches=[{**original, "id": str(i)} for i in range(5)])
        with self.assertRaises(ValidationError):
            ScenarioProjectionRequest(ticker="ABC", horizonDays=30, branches=[{"id": "one", "title": "Test", "event": "Hypothèse", "shockPct": 10, "eventAfterObservations": 10}])

    def test_zero_day_shock_is_not_shifted_and_sources_are_preserved(self):
        result = simulation.project_scenarios(self.request(branches=[{"id": "one", "title": "Immédiat", "event": "Hypothèse", "shockPct": 10, "eventAfterDays": 0, "sourceUrl": "https://example.org/source"}]))
        branch = result["branches"][0]
        self.assertEqual(branch["path"][0]["medianPrice"], 110)
        self.assertEqual(branch["eventAfterDays"], 0)
        self.assertEqual(branch["sourceUrl"], "https://example.org/source")

    def test_capabilities_report_readiness_bounds_and_safe_dataset_origin(self):
        result = simulation.simulation_capabilities()
        self.assertTrue(result["ready"])
        self.assertEqual(result["supportedTickers"], ["ABC"])
        self.assertEqual(result["limits"]["branches"], {"min": 1, "max": 4})
        self.assertEqual(result["limits"]["calendar_days"], {"min": 1, "max": 120})
        self.assertEqual(result["tickerCapabilities"][0]["asOf"], self.dates[-1].isoformat())
        self.assertEqual(result["sourceClassification"], "observations")
        self.assertEqual(len(result["requiredFiles"]), 3)
        self.assertNotIn(self.temp.name, json.dumps(result))
        route = next(route for route in simulation.router.routes if route.path == "/v1/simulation/capabilities")
        self.assertIn("GET", route.methods)
        self.assertEqual(route.endpoint()["supportedTickers"], ["ABC"])

    def test_missing_and_invalid_files_produce_safe_capability_failures(self):
        (self.root / "prices_daily.csv").unlink()
        result = simulation.simulation_capabilities()
        self.assertFalse(result["ready"])
        self.assertEqual(result["supportedTickers"], [])
        self.assertEqual(result["failures"][0]["code"], "missing_file")
        self.assertNotIn(self.temp.name, json.dumps(result))
        self.write("prices_daily.csv", [{"wrong": "columns"}])
        self.assertEqual(simulation.simulation_capabilities()["failures"][0]["code"], "invalid_columns")

    def test_insufficient_windows_fail_without_rewriting_the_request(self):
        self.write("prices_daily.csv", [{"ticker": "ABC", "date": observed.isoformat(), "adj_close": "100", "volume": "100"} for observed in self.dates[:25]])
        request = self.request(horizonDays=120)
        with self.assertRaises(HTTPException) as raised:
            simulation.project_scenarios(request)
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(request.horizonDays, 120)
        self.assertEqual(len(request.branches), 1)
        cap = simulation.simulation_capabilities()
        self.assertTrue(cap["ready"])
        self.assertLess(cap["tickerCapabilities"][0]["maxHorizonDays"], 120)
        self.assertEqual(cap["tickerCapabilities"][0]["maxHorizonObservations"], 5)

    def test_history_uses_declared_provenance_and_only_safe_source_urls(self):
        self.write("sources_metadata.csv", [{"file": "prices_daily.csv", "source": "Yahoo Finance via yfinance", "source_url": "https://finance.yahoo.com"}])
        observed = simulation.history("ABC", start=None, end=None)
        self.assertEqual(observed["sourceClassification"], "observations")
        self.assertEqual(observed["sourceUrl"], "https://finance.yahoo.com")
        self.assertEqual(observed["sourceAsOf"], self.dates[-1].isoformat())
        self.write("sources_metadata.csv", [{"file": "prices_daily.csv", "source": "Synthetic fixture", "source_url": "https://finance.yahoo.com"}])
        illustrative = simulation.history("ABC", start=None, end=None)
        self.assertEqual(illustrative["sourceClassification"], "illustrative")
        self.assertNotIn("sourceUrl", illustrative)

    def test_source_classification_follows_declared_synthetic_metadata(self):
        self.write("sources_metadata.csv", [{"file": "prices_daily.csv", "source": "Synthetic illustrative fixture"}])
        result = simulation.project_scenarios(self.request())
        self.assertEqual(result["sourceClassification"], "illustrative")
        self.assertEqual(simulation.simulation_capabilities()["sourceClassification"], "illustrative")
        (self.root / "sources_metadata.csv").unlink()
        self.assertEqual(simulation.simulation_capabilities()["sourceClassification"], "unknown")


if __name__ == "__main__":
    unittest.main()
