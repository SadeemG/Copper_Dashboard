# Copper Market Intelligence

A source-first weekly dashboard covering:

1. Mine disruption tracker
2. Current market tightness
3. Two-to-three-year supply/demand outlook
4. Cyclical and structural demand drivers

## Operating model

The weekly pipeline deliberately separates collection from judgment:

1. `automation/update_weekly.py` checks Tier 1 operator and regulatory sources.
2. It checks Tier 2 market and structural sources.
3. Only then does it query GDELT for wide-web discovery.
4. It writes `data/source_checks.json` and `data/candidates.json`, preserving URLs, source tier, timestamps and fingerprints.
5. It updates the dashboard's freshness metadata.
6. `automation/validate_data.py` blocks malformed data or unlabeled scenarios.
7. Material risk, tightness or outlook changes remain analyst-reviewed edits to `data/current.json`.

This avoids an automated news headline silently becoming an investment conclusion.

## Weekly schedule

`.github/workflows/weekly-copper-update.yml` runs at 06:17 UTC each Monday and can also be started manually. It commits the evidence snapshot, creating a versioned audit trail. The separate Pages workflow validates, builds and deploys the site after each data change.

## Publish a shareable link

1. Push this project to the `main` branch of a GitHub repository.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions**.
4. Run **Deploy copper dashboard** once from the Actions tab.
5. The resulting URL will be `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/` unless your organisation uses a custom GitHub Pages domain.

GitHub Pages sites are public by default. For confidential internal research, use an access-controlled host instead of Pages.

## Local preview

From the repository root:

```powershell
python automation/validate_data.py
python automation/build_site.py
python -m http.server 8000 --directory dist
```

Open `http://localhost:8000`.

## Weekly analyst checklist

- Review every Tier 1 changed-source candidate before Tier 3 news.
- Confirm production bases: attributable vs 100%, concentrate vs cathode/anode, production vs sales.
- Do not sum operator impact estimates unless their units and baselines are comparable.
- Separate mine/concentrate tightness from refined-market balance.
- Label internal scenarios and assumptions explicitly.
- Move reviewed candidates into `data/current.json`, update the narrative, and validate before publishing.

## Files

- `data/current.json`: published dashboard dataset and evidence.
- `data/source_checks.json`: automated check health and fingerprints.
- `data/candidates.json`: unreviewed source-change and broad-news queue.
- `automation/source_registry.json`: ordered source registry.
- `automation/update_weekly.py`: collector and audit writer.
- `automation/validate_data.py`: publication gate.
- `automation/build_site.py`: dependency-free static build.
