#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir()
for name in ("index.html", "styles.css", "app.js"):
    shutil.copy2(ROOT / name, DIST / name)
shutil.copytree(ROOT / "data", DIST / "data")
(DIST / ".nojekyll").write_text("", encoding="utf-8")
print(f"Built static site at {DIST}")
