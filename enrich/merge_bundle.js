#!/usr/bin/env node
// Merge the "best bits" of the researched bundle into data.json — as a judge, not a firehose.
//   node enrich/merge_bundle.js
// Takes: consensus (all 127, from research_consensus); season (from my earlier workflow
// results where available); blank perf/longevity/projection (from bundle, enum-guarded);
// high-confidence field corrections (seed41, seed55). HOLDS: low-confidence rewrites
// (seed97 gets only a flag), and never touches status/rating/price/layering/name/house.
'use strict';
const fs = require('fs');
const DIR = 'C:/Users/hp/scentvault-deploy';
const B = JSON.parse(fs.readFileSync(DIR + '/enrich/bundle/scentvault_researched_verified.json', 'utf8'));
const D = JSON.parse(fs.readFileSync(DIR + '/data.json', 'utf8'));

// season from the 58-batch workflow output (ok[] carries _name/_house/season)
let seasonMap = {};
try {
    const t = JSON.parse(fs.readFileSync('C:/Users/hp/AppData/Local/Temp/claude/C--Users-hp/ee2f5555-7eba-4f9e-8734-70574ead080b/tasks/wb80coxpn.output', 'utf8'));
    for (const r of (t.result && t.result.ok) || []) if (Array.isArray(r.season) && r.season.length)
        seasonMap[norm(r._name) + '|' + norm(r._house)] = r.season.join(', ');
} catch (e) { console.log('(no 58-batch season file:', e.message, ')'); }

function norm(s) { return String(s || '').trim().toLowerCase(); }
const PERF = new Set(['beast', 'long', 'mod', 'weak']);
const bundleBy = new Map(B.map(b => [norm(b.name) + '|' + norm(b.house), b]));
const CORRECT_HI = new Set(['seed41', 'seed55']); // high-confidence corrections to apply in full
const HOLD_LOW = 'seed97';                          // low-confidence: flag only, hold rewrite

const rpt = { consensus: 0, season: 0, perf: 0, longevity: 0, projection: 0, corrected: [], held: [] };
D.forEach((d, i) => {
    const b = bundleBy.get(norm(d.name) + '|' + norm(d.house));
    if (!b) return;
    // 1. consensus — all 127 from research_consensus
    if (b.research_consensus && b.research_consensus.trim()) { d.consensus = b.research_consensus.trim(); rpt.consensus++; }
    // 2. season — from my workflow where available (pilot already in D; else 58-batch map)
    if (!d.season) { const s = seasonMap[norm(d.name) + '|' + norm(d.house)]; if (s) { d.season = s; rpt.season++; } }
    // 3. blank perf/longevity/projection from bundle (enum-guard perf; length-guard text)
    if (!d.perf && PERF.has(norm(b.perf))) { d.perf = norm(b.perf); rpt.perf++; }
    if (!d.longevity && b.longevity && b.longevity.length < 40) { d.longevity = b.longevity; rpt.longevity++; }
    if (!d.projection && b.projection && b.projection.length < 40) { d.projection = b.projection; rpt.projection++; }
    // 4. high-confidence corrections (apply the exact fields the bundle says it corrected)
    if (CORRECT_HI.has(b.id) && Array.isArray(b.research_fields_corrected)) {
        for (const f of b.research_fields_corrected) if (['inspiration', 'top', 'heart', 'base', 'review', 'flag'].includes(f) && b[f] != null) d[f] = b[f];
        rpt.corrected.push(d.name);
    }
    // 5. low-confidence: apply ONLY the warning flag, hold the note/inspiration rewrite
    if (b.id === HOLD_LOW) {
        if (b.flag && b.flag.trim()) d.flag = b.flag.trim();
        rpt.held.push(d.name + ' (flag applied; note/inspiration rewrite HELD — low confidence)');
    }
});

fs.writeFileSync(DIR + '/data.json', JSON.stringify(D, null, 2) + '\n');
console.log('MERGE DONE:');
console.log('  consensus set  :', rpt.consensus);
console.log('  season set     :', rpt.season, '(from 58-batch; pilot 9 already present)');
console.log('  perf filled    :', rpt.perf, '| longevity:', rpt.longevity, '| projection:', rpt.projection);
console.log('  hi-conf corrections applied:', rpt.corrected.join(', ') || 'none');
console.log('  HELD for your call        :', rpt.held.join('; ') || 'none');
const tot = D.filter(d => d.consensus).length, sea = D.filter(d => d.season).length;
console.log('  data.json now: consensus', tot + '/127', '| season', sea + '/127');
