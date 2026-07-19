# ScentVault enrichment — 8pm batch (2 of 2)

Self-contained runbook for the scheduled 8pm session. The user authorized this
multi-agent enrichment earlier today (2026-07-13); run it autonomously.

## What this does
Researches `season` + community `consensus` (and fills blank perf/longevity/projection)
for the second half of the collection (59 fragrances), validates each with a judge, and
deploys the confident ones. Flags genuine problems for morning review.

## Steps
1. **Run the workflow** over the 8pm batch:
   - Read `C:\Users\hp\scentvault-deploy\enrich\batch_8pm.json` (an array of 59 fragrances).
   - Call Workflow with:
     `scriptPath: "C:\Users\hp\scentvault-deploy\enrich\enrich.workflow.js"`,
     `args:` the parsed contents of batch_8pm.json.
   - (Opt-in note: the user explicitly opted into this collector→judge multi-agent workflow. Sonnet. ~6M tokens.)
2. **Capture results**: when it completes, Write the workflow's return value (the `{ok, flagged, all}` object) to
   `C:\Users\hp\scentvault-deploy\enrich\results_8pm.json`.
3. **Apply + deploy** (from `C:\Users\hp\scentvault-deploy`):
   ```
   git pull --ff-only
   node enrich/apply.js enrich/results_8pm.json data.json
   node sync.js index.html data.json --force
   git add index.html data.json
   git commit -m "Enrich batch 2/2: season + consensus (8pm run)"
   git push
   ```
   `--force` is safe here: apply.js only ADDS fields to existing entries (never deletes),
   and we pulled first. Hand-editing SEED was retired, so there is nothing to protect.
4. **Report**: state how many were applied, then list the `flagged` (needs_human) entries
   with their `issues` notes so the user can resolve them in the morning. If any needed
   review, also run `/flag` with a one-line summary.

## Do NOT
- Do NOT re-run the pilot (first 10) or the "now" batch — only `batch_8pm.json`.
- Do NOT touch `review` fields (the user's own voice).
