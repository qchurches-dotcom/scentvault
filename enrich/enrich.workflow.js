export const meta = {
  name: 'scentvault-enrich',
  description: 'Research season + community-consensus (and blank perf/longevity/projection) per fragrance, then judge-validate each',
  phases: [
    { title: 'Collect', detail: 'web-research season/consensus per fragrance' },
    { title: 'Judge', detail: 'validate + flag inconsistencies per fragrance' },
  ],
}

const SEASON_ITEMS = { type: 'string', enum: ['spring', 'summer', 'fall', 'winter'] }

const COLLECT = {
  type: 'object', additionalProperties: false,
  required: ['name', 'season', 'consensus', 'confidence', 'sources'],
  properties: {
    name: { type: 'string' },
    season: { type: 'array', items: SEASON_ITEMS, maxItems: 4 },
    consensus: { type: 'string', description: 'Community verdict: praise + the common gripe. <=220 chars. Grounded in real Fragrantica/Reddit findings, NOT invented.' },
    perf: { type: 'string', enum: ['beast', 'long', 'mod', 'weak', ''], description: 'Only if asked (perf was blank); else ""' },
    longevity: { type: 'string', description: 'e.g. "7-9h". Only if asked; else ""' },
    projection: { type: 'string', description: 'e.g. "Moderate-Strong". Only if asked; else ""' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    sources: { type: 'string', description: 'Brief note of what was actually found and where (e.g. "Fragrantica seasons chart + 3 Reddit threads"). If you could not find real data, say so and set confidence=low.' },
  },
}

const JUDGE = {
  type: 'object', additionalProperties: false,
  required: ['name', 'season', 'consensus', 'verdict', 'issues', 'confidence'],
  properties: {
    name: { type: 'string' },
    season: { type: 'array', items: SEASON_ITEMS, maxItems: 4 },
    consensus: { type: 'string' },
    perf: { type: 'string' },
    longevity: { type: 'string' },
    projection: { type: 'string' },
    verdict: { type: 'string', enum: ['ok', 'needs_human'] },
    issues: { type: 'string', description: 'Empty if ok. Otherwise the specific inconsistency/thin-sourcing that needs a human.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
}

const ask = f => {
  const need = []
  if (!f.have_perf) need.push('perf (beast/long/mod/weak)')
  if (!f.have_longevity) need.push('longevity (e.g. 7-9h)')
  if (!f.have_projection) need.push('projection (e.g. Moderate-Strong)')
  return need.length ? `\nAlso fill (currently blank): ${need.join(', ')}.` : ''
}

const collectPrompt = f => `You are a fragrance research assistant. Fragrance: "${f.name}" by ${f.house}${f.inspiration ? ` (inspired by / clone of: ${f.inspiration})` : ''}. Family: ${f.family}.

Use web search (Fragrantica, Reddit r/fragrance & r/DesiFragranceAddicts, YouTube reviews) to determine:
1. SEASON: which of spring/summer/fall/winter it is genuinely recommended for (multiple allowed; base on Fragrantica's season voting + reviewer consensus).
2. CONSENSUS: one tight sentence of the community verdict — what it's praised for AND the most common gripe (<=220 chars). This is the crowd's view, not yours.${ask(f)}

DISCIPLINE (important): base everything on what you actually find. If sources are thin or you can't confirm, set confidence="low" and say so in "sources" — do NOT invent seasons or a consensus. It's better to flag uncertainty than to guess. Load web tools via ToolSearch if they aren't already available.`

const judgePrompt = (f, c) => `You are validating researched data for the fragrance "${f.name}" by ${f.house} (family: ${f.family}, DNA: ${f.inspiration || 'n/a'}).

Collector proposed:
- season: ${JSON.stringify(c.season)}
- consensus: ${JSON.stringify(c.consensus)}
- perf: ${JSON.stringify(c.perf || '')}, longevity: ${JSON.stringify(c.longevity || '')}, projection: ${JSON.stringify(c.projection || '')}
- confidence: ${c.confidence}
- sources: ${c.sources}

CALIBRATION: this is a personal fragrance tracker — low stakes. Fragrantica and Reddit block bots, so secondary sources (review blogs, YouTube, clone-comparison sites, search snippets citing Fragrantica's vote data) are the EXPECTED, acceptable evidence base here — NOT a red flag on their own. Do not flag merely because the primary page couldn't be fetched or sourcing is "secondhand"; that is the norm for this task.

Check for GENUINE problems only:
- Does the season fit the scent profile? (a heavy sweet gourmand tagged summer-only, or a fresh citrus tagged winter-only, is suspect.)
- Is the consensus specific to THIS scent, not generic boilerplate that could apply to anything?
- Do the sources actually corroborate the claim, or do they conflict / read invented?
- Was the fragrance actually FOUND, or could it not be located anywhere (possible mis-naming)?

Tighten the consensus to <=220 chars if needed. Return the FINAL season/consensus/perf/longevity/projection.
Set verdict="ok" when the data is internally consistent AND corroborated by at least two independent secondary sources (or one clearly relaying Fragrantica's own vote data). Set verdict="needs_human" (with a specific "issues" note) ONLY for a real problem: the fragrance couldn't be found at all / looks mis-named; the season contradicts the profile; the consensus is boilerplate or contradicts its sources; or the sources genuinely conflict. Thin-but-consistent secondary sourcing is NOT by itself grounds to flag.`

phase('Collect')
const FRAGS = typeof args === 'string' ? JSON.parse(args) : args
log(`Enriching ${FRAGS.length} fragrances (season + consensus + blank perf/longevity/projection), collector -> judge.`)

const results = await pipeline(
  FRAGS,
  f => agent(collectPrompt(f), { label: `collect:${f.name}`, phase: 'Collect', model: 'sonnet', schema: COLLECT }),
  (c, f) => c
    ? agent(judgePrompt(f, c), { label: `judge:${f.name}`, phase: 'Judge', model: 'sonnet', schema: JUDGE })
        .then(j => ({ ...j, _name: f.name, _house: f.house, _collectorConfidence: c.confidence, _sources: c.sources }))
    : null,
)

const clean = results.filter(Boolean)
const ok = clean.filter(r => r.verdict === 'ok')
const flagged = clean.filter(r => r.verdict === 'needs_human')
log(`Done: ${ok.length} ok, ${flagged.length} need human review, ${FRAGS.length - clean.length} died.`)
return { ok, flagged, all: clean }
