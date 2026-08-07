#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data" / "current.json").read_text(encoding="utf-8"))
errors = []


def require(condition, message):
    if not condition:
        errors.append(message)


for key in ("meta", "kpis", "disruptions", "reference_mines", "tightness", "outlook", "drivers", "source_register", "methodology"):
    require(key in DATA, f"missing top-level key: {key}")
require(len(DATA.get("kpis", [])) == 4, "dashboard requires exactly four headline KPIs")
require(len(DATA.get("disruptions", [])) > 0, "at least one disruption is required")

ids = set()
for mine in DATA.get("disruptions", []):
    require(mine.get("id") not in ids, f"duplicate mine id: {mine.get('id')}")
    ids.add(mine.get("id"))
    require(mine.get("risk") in {"HIGH", "MEDIUM", "LOW"}, f"invalid risk for {mine.get('name')}")
    require(-90 <= mine.get("lat", 999) <= 90 and -180 <= mine.get("lon", 999) <= 180, f"invalid coordinates for {mine.get('name')}")
    source = mine.get("source", {})
    require(source.get("tier") in {1, 2, 3}, f"invalid source tier for {mine.get('name')}")
    require(urlparse(source.get("url", "")).scheme == "https", f"non-HTTPS source for {mine.get('name')}")

reference_names = set()
for mine in DATA.get("reference_mines", {}).get("items", []):
    require(mine.get("name") not in reference_names, f"duplicate reference mine: {mine.get('name')}")
    reference_names.add(mine.get("name"))
    require(-90 <= mine.get("lat", 999) <= 90 and -180 <= mine.get("lon", 999) <= 180, f"invalid reference coordinates for {mine.get('name')}")

drivers = DATA.get("drivers", {})
end_use = drivers.get("end_use", [])
require(len(end_use) > 0, "at least one copper end-use sector is required")
require(sum(item.get("share", 0) for item in end_use) == 100, "copper end-use shares must sum to 100")
require(urlparse(drivers.get("end_use_source", {}).get("url", "")).scheme == "https", "copper end-use source must use HTTPS")
for driver in drivers.get("items", []):
    require(driver.get("evidence") in {1, 2, 3, 4, 5}, f"evidence KPI for {driver.get('name')} must be between 1 and 5")

for name, scenario in DATA.get("outlook", {}).get("scenarios", {}).items():
    lengths = {len(scenario.get(key, [])) for key in ("years", "supply", "demand")}
    require(lengths == {3}, f"scenario {name} must have three aligned years")
    require("internal" in scenario.get("note", "").lower() or "ICSG" in scenario.get("note", ""), f"scenario {name} must disclose forecast provenance")

if errors:
    print("Validation failed:")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)
print(f"Validated {len(DATA['disruptions'])} disruptions, {len(DATA['drivers']['items'])} demand drivers and {len(DATA['source_register'])} source tiers")
