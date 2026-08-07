#!/usr/bin/env python3
"""Source-first weekly collector.

This collector does not silently rewrite analyst conclusions. It refreshes source
checks, produces an auditable candidate queue, and updates dashboard freshness.
Material assessment changes remain explicit edits to data/current.json.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "automation" / "source_registry.json"
CURRENT_PATH = ROOT / "data" / "current.json"
CHECKS_PATH = ROOT / "data" / "source_checks.json"
CANDIDATES_PATH = ROOT / "data" / "candidates.json"


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def clean_html(raw: str) -> str:
    raw = re.sub(r"<script\b[^>]*>.*?</script>", " ", raw, flags=re.I | re.S)
    raw = re.sub(r"<style\b[^>]*>.*?</style>", " ", raw, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def fetch(url: str, user_agent: str, timeout: int) -> tuple[int, str, str]:
    request = urllib.request.Request(url, headers={"User-Agent": user_agent, "Accept": "text/html,application/json"})
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
        body = response.read(2_500_000)
        content_type = response.headers.get("content-type", "")
        charset = response.headers.get_content_charset() or "utf-8"
        return response.status, body.decode(charset, errors="replace"), content_type


def fingerprint(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text).strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def keyword_hits(text: str, terms: list[str]) -> list[str]:
    lowered = text.lower()
    return [term for term in terms if term.lower() in lowered]


def relevant_passages(text: str, terms: list[str]) -> str:
    """Remove volatile page chrome and retain passages related to registry terms."""
    chunks = re.split(r"(?<=[.!?])\s+|\s{2,}", text)
    selected = [chunk for chunk in chunks if any(term.lower() in chunk.lower() for term in terms)]
    return " ".join(selected[:250]) or text[:100_000]


def check_curated_sources(registry: dict, previous: dict, now: datetime, offline: bool) -> list[dict]:
    checks = []
    prior_map = {item["id"]: item for item in previous.get("checks", [])}
    for tier_name, tier in (("primary", 1), ("market_context", 2)):
        for source in registry[tier_name]:
            record = {"id": source["id"], "name": source["name"], "tier": tier, "url": source["url"], "checked_at": now.isoformat()}
            if offline:
                record.update({"status": "offline-skip", "fingerprint": prior_map.get(source["id"], {}).get("fingerprint", ""), "changed": False, "keyword_hits": []})
                checks.append(record)
                continue
            try:
                status, body, _ = fetch(source["url"], registry["user_agent"], registry["timeout_seconds"])
                text = clean_html(body)
                relevant = relevant_passages(text, source.get("terms", []))
                digest = fingerprint(relevant)
                prior_digest = prior_map.get(source["id"], {}).get("fingerprint")
                record.update({
                    "status": f"ok:{status}", "fingerprint": digest,
                    "changed": bool(prior_digest and prior_digest != digest),
                    "keyword_hits": keyword_hits(text, source.get("terms", [])),
                    "content_sample": relevant[:450]
                })
            except Exception as exc:  # network failures must remain visible in audit data
                record.update({"status": "error", "error": str(exc)[:300], "fingerprint": prior_map.get(source["id"], {}).get("fingerprint", ""), "changed": False, "keyword_hits": []})
            checks.append(record)
    return checks


def fetch_wide_web(registry: dict, now: datetime, offline: bool) -> list[dict]:
    if offline:
        return []
    config = registry["wide_web"]
    params = urllib.parse.urlencode({
        "query": config["query"], "mode": "artlist", "maxrecords": config["max_records"],
        "format": "json", "timespan": config["timespan"], "sort": "datedesc"
    })
    payload = None
    last_error = None
    for attempt in range(3):
        try:
            _, body, _ = fetch(f"{config['endpoint']}?{params}", registry["user_agent"], registry["timeout_seconds"])
            payload = json.loads(body)
            break
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(4 * (attempt + 1))
    if payload is None:
        return [{"source_tier": 3, "status": "error", "error": str(last_error)[:300], "retrieved_at": now.isoformat()}]
    candidates = []
    seen = set()
    for article in payload.get("articles", []):
        url = article.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)
        candidates.append({
            "source_tier": 3, "status": "discovery", "title": article.get("title", "Untitled"),
            "url": url, "domain": article.get("domain", ""), "published": article.get("seendate", ""),
            "language": article.get("language", ""), "retrieved_at": now.isoformat(), "reviewed": False
        })
    return candidates


def build_candidates(checks: list[dict], broad: list[dict], now: datetime) -> dict:
    curated = [{
        "source_tier": check["tier"], "status": "source-changed", "title": f"New content detected: {check['name']}",
        "url": check["url"], "keyword_hits": check.get("keyword_hits", []), "retrieved_at": check["checked_at"],
        "reviewed": False
    } for check in checks if check.get("changed")]
    discoveries = [item for item in broad if item.get("status") == "discovery"]
    broad_status = next((item for item in broad if item.get("status") == "error"), {"status": "ok"})
    return {"generated_at": now.isoformat(), "review_required": bool(curated or discoveries), "curated_candidates": curated, "wide_web_candidates": discoveries, "wide_web_status": broad_status}


def refresh_dashboard_meta(checks: list[dict], candidates: dict, now: datetime, offline: bool):
    current = load_json(CURRENT_PATH, {})
    successful = sum(check.get("status", "").startswith("ok:") for check in checks)
    current["meta"].update({
        "generated_at": now.isoformat(),
        "as_of": now.strftime("%d %B %Y").lstrip("0"),
        "next_refresh": (now + timedelta(days=7)).strftime("%d %B %Y").lstrip("0"),
        "sources_checked": current["meta"].get("sources_checked", 0) if offline else successful,
        "review_status": "offline validation" if offline else ("candidate changes awaiting analyst review" if candidates["review_required"] else "automated source pass; no flagged changes")
    })
    save_json(CURRENT_PATH, current)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="Exercise the pipeline without network requests")
    args = parser.parse_args()
    registry = load_json(REGISTRY_PATH, {})
    previous = load_json(CHECKS_PATH, {"checks": []})
    now = datetime.now(timezone.utc).replace(microsecond=0)
    checks = check_curated_sources(registry, previous, now, args.offline)
    broad = fetch_wide_web(registry, now, args.offline)
    candidates = build_candidates(checks, broad, now)
    save_json(CHECKS_PATH, {"generated_at": now.isoformat(), "checks": checks})
    save_json(CANDIDATES_PATH, candidates)
    refresh_dashboard_meta(checks, candidates, now, args.offline)
    errors = sum(check["status"] == "error" for check in checks)
    print(f"Checked {len(checks)} curated sources; {errors} errors; {len(candidates['curated_candidates'])} curated changes; {len(broad)} broad-news candidates")


if __name__ == "__main__":
    main()
