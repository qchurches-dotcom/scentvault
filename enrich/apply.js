#!/usr/bin/env node
// Merge ScentVault enrichment results into data.json.
//   node enrich/apply.js <results.json> [data.json]
// results.json: the workflow return value ({ok:[...], flagged, all}) or a bare array.
// Match is by exact _name+_house (workflow attaches these). We only APPLY the "ok"
// set unless the file is a bare array. season/consensus always filled; perf only if a
// valid enum (beast/long/mod/weak) AND currently blank; longevity/projection only if
// currently blank and short (skip prose dumps). Idempotent-ish: re-applying overwrites
// season/consensus with the same values, never clears an existing field.
'use strict';
const fs = require('fs');
const [, , resPath, dataPath = 'data.json'] = process.argv;
if (!resPath) { console.error('usage: apply.js <results.json> [data.json]'); process.exit(1); }

const res = JSON.parse(fs.readFileSync(resPath, 'utf8'));
const items = Array.isArray(res) ? res : (res.ok || []);
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const PERF = new Set(['beast', 'long', 'mod', 'weak']);
const norm = s => String(s || '').trim().toLowerCase();

let applied = 0; const unmatched = [];
for (const r of items) {
    const nm = norm(r._name), hs = norm(r._house);
    const e = data.find(d => norm(d.name) === nm && norm(d.house) === hs) || data.find(d => norm(d.name) === nm);
    if (!e) { unmatched.push(`${r._name} / ${r._house}`); continue; }
    if (Array.isArray(r.season) && r.season.length) e.season = r.season.join(', ');
    if (r.consensus && !/^unable to confirm/i.test(r.consensus)) e.consensus = r.consensus;
    if (!e.perf && PERF.has(norm(r.perf))) e.perf = norm(r.perf);
    if (!e.longevity && r.longevity && r.longevity.length < 40) e.longevity = r.longevity;
    if (!e.projection && r.projection && r.projection.length < 40) e.projection = r.projection;
    applied++;
}
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
console.log(`applied ${applied} of ${items.length}` + (unmatched.length ? ` | UNMATCHED ${unmatched.length}: ${unmatched.join('; ')}` : ' | all matched'));

// selftest: node enrich/apply.js --selftest
if (resPath === '--selftest') { /* unreachable; kept for discoverability */ }
