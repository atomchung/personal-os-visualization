import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { syntheticJudgmentUpdate, syntheticIntradayReading } from './fixtures/today-presentation.ts'
import { syntheticClaimEvidence } from './fixtures/claim-evidence.ts'

const { chromium } = await import(process.env.PLAYWRIGHT_RUNTIME || 'playwright')
const origin = process.env.UI_URL || 'http://127.0.0.1:5197'
const output = process.env.BROWSER_OUTPUT || '.artifacts/investment-hub'
await mkdir(output, { recursive: true })
for (let attempt = 0; attempt < 40; attempt++) {
  try { if ((await fetch(origin)).ok) break } catch {}
  if (attempt === 39) throw new Error('Preview did not start')
  await new Promise(resolve => setTimeout(resolve, 250))
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE })
const report = { revision: process.env.GITHUB_SHA || 'local-preview', browser: browser.version(), mode: 'synthetic-only', pages: [], scenarios: [] }
const tabs = ['Today', '我的判斷', '研究與策略', '復盤與學習']
async function layout(page, label) {
  const result = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    headings: [...document.querySelectorAll('h1,h2,h3')].filter(el => el.getClientRects().length).map(el => el.textContent) }))
  assert.ok(result.scrollWidth <= result.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(result)}`)
  return result
}
async function expand(panel) {
  for (let depth = 0; depth < 3; depth++) {
    await panel.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = true }))
    await panel.page().waitForTimeout(100)
  }
}
async function fault(page, scenario) {
const judgmentFixture = scenario.startsWith('operations-') ? syntheticJudgmentUpdate('preserved') : scenario.startsWith('judgment-')
  ? syntheticJudgmentUpdate(scenario === 'judgment-unchanged' ? 'unchanged' : scenario.startsWith('judgment-quiet') ? 'preserved' : 'reassessed') : null
const claimFixture = scenario.startsWith('claim-') ? syntheticClaimEvidence() : null
const intradayFixture = scenario.startsWith('intraday-') ? syntheticIntradayReading() : null
await page.addInitScript(({ scenario, judgmentFixture, claimFixture, intradayFixture }) => {
  window.__investmentReadHook = async data => {
    if (intradayFixture && data?.brief && data?.today) {
      data.brief = structuredClone(intradayFixture.brief)
      data.today = structuredClone(intradayFixture.today)
      if (scenario === 'intraday-partial') { data.today.state = 'partial'; data.today.updates[1].coverage_state = 'partial' }
      if (scenario === 'intraday-missing-formal') data.brief.state = 'missing'
      if (scenario === 'intraday-unknown') Object.assign(data.today.updates[0], {
        scan_mode: null, market_scope: null, observed_at: '2001-02-03', scan_completed_at: '2001-02-03',
        summary: '合成時間與模式未知的來源內容。',
      })
    }
    if (scenario.startsWith('operations-') && ['market', 'news'].includes(data?.action)) {
      const outcome = scenario.slice('operations-'.length)
      if (outcome === 'pending') await new Promise(() => {})
      Object.assign(data, {
        state: outcome === 'no-request' ? 'idle' : outcome === 'quiet' ? data.action === 'news' ? 'no-change' : 'success' : outcome,
        started_at: new Date(Date.now() - 5000).toISOString(), last_updated: '2001-02-03T10:00:34+08:00',
        message: 'Synthetic technical partial/null sync adapter record.', error: outcome === 'failed' ? 'synthetic-failure-code' : null,
        discovery_state: 'idle', provider: data.action === 'news' ? 'agy' : null, model: 'synthetic-model',
        provider_errors: { agy: 'synthetic-provider-error' }, market_scope: 'tw', scan_mode: 'quick', duration_seconds: 90,
      })
    }
    if (scenario === 'refresh-partial-news' && data?.action === 'news') {
      Object.assign(data, {
        state: 'partial', last_updated: '2026-10-06T21:20:00+08:00',
        message: '合成快掃部分完成，來源覆蓋仍不完整。', error: null,
        provider: 'agy', model_work_state: null, new_update_count: null,
        market_scope: 'us', scan_mode: 'quick',
      })
      window.__partialRefreshPayload = structuredClone(data)
    }
    if (claimFixture && data?.narratives?.[0]?.thesis_evidence) {
      data.narratives[0].thesis_evidence = structuredClone(claimFixture)
      const evidence = data.narratives[0].thesis_evidence
      if (scenario === 'claim-missing') {
        delete evidence.evidence_claim_relations
        for (const layer of evidence.layers) for (const row of layer.evidence) delete row.claim_relations
      }
      if (scenario === 'claim-empty') evidence.evidence_claim_relations.relations = []
      if (scenario === 'claim-unavailable') data.state = 'unavailable'
      if (scenario === 'claim-ready') {
        data.state = 'ready'
        data.limitations = []
        data.narratives[0].state = 'ready'
        data.narratives[0].state_reason = null
      }
      if (scenario === 'claim-relations') evidence.evidence_claim_relations.relations[2].reason += ' 這段是合成長文，用來檢查窄畫面的閱讀：' + '同一筆資料對不同假設可能有不同意義，須保留來源限制。'.repeat(5)
    }
    if (judgmentFixture && data?.brief && data?.today) {
      data.brief = structuredClone(judgmentFixture.brief)
      data.today = structuredClone(judgmentFixture.today)
      const market = data.today.intraday_refresh.markets.tw
      if (scenario === 'operations-no-request' || scenario === 'operations-pending') {
        market.state = 'not_requested'; market.latest_receipt = null
        data.today.current_judgment.state = 'baseline_only'; data.today.current_judgment.latest_assessment = null
        market.current_judgment.latest_assessment = null
      }
      if (scenario === 'operations-failed' || scenario === 'operations-partial') {
        market.state = scenario.slice('operations-'.length)
        market.latest_receipt.result = market.state; market.latest_receipt.coverage_state = market.state
      }
      if (scenario === 'judgment-failed') { market.state = 'failed'; market.latest_receipt.result = 'failed' }
      if (scenario === 'judgment-stale') { market.freshness = 'stale'; data.brief.state = 'stale' }
      if (scenario === 'judgment-mismatch') market.baseline_revision = 'sha256:other-baseline'
      if (scenario === 'judgment-quiet-partial') market.latest_receipt.coverage_state = 'partial'
      if (scenario === 'judgment-quiet-unknown') delete market.latest_receipt.coverage_state
      if (scenario === 'judgment-change') data.today.current_judgment.current_delta.why_now += ' 合成長文：' + '一次觀察仍不能代表每季表現，來源需要繼續驗證。'.repeat(6)
      // Mirror the exact same provider payload rather than inventing a second assessment.
      if (scenario === 'judgment-change') market.current_judgment.current_delta = structuredClone(data.today.current_judgment.current_delta)
    }
    if (scenario === 'market-observation-legacy-timeline' && data?.brief && data?.today) {
      const formal = { information_kind: 'market_observation', market: 'us', event: '合成舊版簡報市場讀數', observation_value: '虛構正式讀數 0.4%', source_path: 'synthetic/formal-market.md' }
      const unknownMarket = { ...formal, market: 'unknown', event: '合成未識別市場讀數', source_path: 'synthetic/unknown-market.md' }
      const incremental = { information_kind: 'market_observation', market: 'us', event: '合成盤中回執與時間軸同一讀數', observation_value: '虛構盤中讀數 1.1%', observed_at: '2026-09-30T09:10:00+08:00', source_path: 'synthetic/intraday-market.md' }
      data.brief.market_observations = [formal, unknownMarket]
      data.today.timeline = [
        { kind: 'brief', at: '2026-09-29T21:15:00+08:00', timeline_at: '2026-09-29T21:30:00+08:00', date: '2026-09-29', session: 'us-open-prep', generated_at: '2026-09-29T21:30:00+08:00', source_cutoff: '2026-09-29T21:15:00+08:00', path: 'synthetic/formal-brief.md', headline: '合成正式基準', events: [], market_observations: [] },
        { ...incremental, kind: 'update', at: incremental.observed_at, timeline_at: incremental.observed_at, summary: '合成時間軸投影額外摘要。', id: 'synthetic-market-observation-update', story_id: null, portfolio_impact: '', action: '', relevance: [] },
      ]
      data.today.intraday_refresh.market_observations = [incremental]
    }
    if (['blank-summary', 'market-observation-legacy-timeline', 'market-observation-only-projection-error'].includes(scenario) && data?.news_events) throw new Error('Synthetic event projection unavailable')
    if (scenario === 'market-observation-event-projection' && data?.brief && data?.today) {
      const earlier = { information_kind: 'market_observation', market: 'tw', event: '更早版次專屬市場讀數', observation_value: '虛構早期讀數 0.2%', observed_at: '2026-09-28T08:00:00+08:00', source_path: 'synthetic/earlier-brief-market.md' }
      const current = { information_kind: 'market_observation', market: 'us', event: '合成目前簡報市場讀數', observation_value: '虛構目前讀數 0.7%', observed_at: '2026-09-29T21:00:00+08:00', source_path: 'synthetic/current-brief-market.md' }
      data.brief.market_observations = [current]
      data.today.timeline = [
        { kind: 'brief', at: '2026-09-28T08:00:00+08:00', timeline_at: '2026-09-28T08:15:00+08:00', date: '2026-09-28', session: 'us-open-prep', generated_at: '2026-09-28T08:15:00+08:00', source_cutoff: '2026-09-28T08:00:00+08:00', path: 'synthetic/earlier-brief.md', headline: '合成較早版次', events: [], market_observations: [earlier] },
        { kind: 'brief', at: '2026-09-29T21:15:00+08:00', timeline_at: '2026-09-29T21:30:00+08:00', date: '2026-09-29', session: 'us-open-prep', generated_at: '2026-09-29T21:30:00+08:00', source_cutoff: '2026-09-29T21:15:00+08:00', path: 'synthetic/current-brief.md', headline: '合成目前版次', events: [], market_observations: [] },
      ]
    }
    if (Array.isArray(data?.rows) && typeof data?.coverage?.candidate_count === 'number') {
      data.rows = [...data.rows, ...['DEMO-TW-A.TW', 'DEMO-TW-B.TWO', 'DEMO-TW-C.TW'].map(symbol => ({ ...data.rows[0], symbol, holding: true }))]
    }
    if (scenario === 'news-without-timeline' && data?.news_events) {
      data.news_events = { ...data.news_events, state: 'ready', items: [{
        key: 'synthetic-no-timeline', story_id: 'synthetic-no-timeline', title: '合成無時間軸事件', state: 'ready',
        ticker_link_state: 'unknown', thesis_link_state: 'unlinked', affected_tickers: [], ticker_effects: [],
        thesis_effects: [], canonical_claim_effects: [], occurrences: [{ kind: 'brief', title: '合成無時間軸事件', market_reaction: null, interpretation: null, impact: null, source: { path: 'synthetic/no-timeline.md' } }],
        checkpoint: { state: 'unlinked', story_id: null, checks: [] }, limitations: [],
      }] }
    }
    if (scenario === 'missing' && data?.news_events) data.news_events = { ...data.news_events, items: [] }
    if (scenario === 'market-observation-event-projection' && data?.news_events) data.news_events.market_observations = []
    if (scenario === 'market-observation-only-duplicate-timeline' && data?.news_events) data.news_events.market_observations = []
    if (data?.brief && scenario.startsWith('structured-judgment')) {
      const serialized = '合成判斷：先等正式結果； why_now: 尚缺公開需求證據； revisit: 2026-10-05； decision_effect: 需求確認才重新評估； provenance: story_id=demo-storage-event'
      const judgment = { class: 'watch', judgment: '合成判斷：先等正式結果', why_now: '尚缺公開需求證據', revisit: '2026-10-05', decision_effect: '需求確認才重新評估', provenance: { artifact: 'wiki/morning/synthetic-brief.md', source_revision: 'sha256:synthetic-judgment-r1', validated_story_ids: ['demo-storage-event'], source_cutoff: data.brief.source_cutoff } }
      if (scenario === 'structured-judgment-invalid-watch') { judgment.revisit = null; judgment.decision_effect = null }
      if (scenario === 'structured-judgment-invalid-provenance') judgment.provenance = []
      data.brief.judgment = judgment
      data.brief.actions = [serialized]
      if (Array.isArray(data.brief.action_items) && data.brief.action_items.length) {
        data.brief.action_items[0].text = scenario === 'structured-judgment-generic-action' ? `行動：${serialized}` : serialized
        data.brief.action_items[0].kind = scenario === 'structured-judgment-generic-action' ? 'action' : 'unknown'
        if (scenario === 'structured-judgment-multiple-primary') {
          data.brief.action_items.push({ ...data.brief.action_items[0], id: 'ai:synthetic-second', kind: 'unknown', text: '第二筆正式行動，需保留。' })
          data.brief.actions.push('第二筆正式行動，需保留。')
        }
      }
    }
    if (data?.narratives?.[0]?.thesis_evidence?.layers && scenario === 'layer-reading') {
      data.narratives[0].thesis_evidence.layers[0].current_reading = { state: 'partial', text: '合成分層解讀：出貨增加但終端需求待確認', as_of: '2026-09-20', authored_by: 'AI', basis: '合成公開證據', layer_revision: 'synthetic-v1', current_layer_revision: 'synthetic-v1', limitations: ['涵蓋仍不完整'], source: null }
    }
    if (scenario === 'watch-read-error' && Object.keys(data ?? {}).length === 1 && Array.isArray(data?.items)) throw new Error('Synthetic reminder read failure')
    if (scenario === 'watch-eligibility' && Object.keys(data ?? {}).length === 1 && Array.isArray(data?.items)) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]))
      const today = `${parts.year}-${parts.month}-${parts.day}`
      const offsetDate = days => { const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
      const note = (id, kind, status, expires_on, promoted_to_today = false) => ({ id, kind, status, expires_on, promoted_to_today, text: `Synthetic ${id}`, source_id: '', source_label: '', conclusion: '', version: 1, updated_at: '' })
      data.items = [
        note('due-today', 'watch', 'open', today),
        note('promoted', 'watch', 'open', offsetDate(-1), true),
        note('future', 'watch', 'open', offsetDate(1)),
        note('expired', 'watch', 'open', offsetDate(-1)),
        note('completed', 'watch', 'done', today, true),
        note('research-event', 'research', 'open', today, true),
      ]
    }
    if (scenario === 'narrative-stale-partial' && data?.narratives?.[0]?.thesis_evidence) {
      data.narratives[0].state = 'stale'
      data.narratives[0].state_reason = '合成測試：論點來源較舊；僅示範 aggregate 狀態。'
      data.narratives[0].thesis_evidence.state = 'partial'
      data.narratives[0].thesis_evidence.reason = '合成測試：五層證據覆蓋仍不完整。'
    }
    if (scenario === 'narrative-delayed' && Array.isArray(data?.narratives)) await new Promise(resolve => setTimeout(resolve, 600))
    if (data?.artifact === 'tw-holdings-relative-strength' && scenario.startsWith('tw-rs-')) {
      if (scenario === 'tw-rs-read-error') throw new Error('Synthetic RS read error')
      data.state = 'unavailable'
      data.holdings = []
      data.as_of = 'unknown'
    }
    if (Array.isArray(data?.symbols) && data.symbols.length === 1 && data.symbols[0] === 'DEMO') {
      data.symbols = ['DEMO', 'DEMO-TW-A.TW', 'DEMO-TW-B.TWO', 'DEMO-TW-C.TW']
      data.note = '合成測試持倉：DEMO 保留一般報價列，三檔虛構台股代碼只用來驗證相對強度列。'
    }
    if (scenario === 'quote-cached-error' && data?.items?.some(item => 'quoted_at' in item)) {
      if (window.__cachedReadFailure) throw new Error('Synthetic cached quote failure')
      const tw = data.items.find(item => item.market === 'tw')
      if (tw) data.items.push({ ...tw, symbol: '^TWII', code: '^TWII', label: '合成盤中加權指數' })
    }
    if (scenario === 'pulse-cached-error' && window.__cachedReadFailure && data?.index && data?.breadth) throw new Error('Synthetic cached pulse failure')
    if (scenario === 'legacy-evidence' && data?.narratives?.[0]?.thesis_evidence?.layers) {
      const layers = data.narratives[0].thesis_evidence.layers
      delete layers[0].supporting; delete layers[0].opposing; delete layers[0].current_reading
      layers[0].evidence = [{ evidence_id: 'synthetic-legacy-row', polarity: 'supports', player: '合成舊版公開記錄', evidence_date: '2001-02-03', source: { path: 'synthetic-legacy-row.md', line: 9 }, limitations: ['舊版數值保持未知'] }]
      layers[1].evidence = []; delete layers[1].supporting; delete layers[1].opposing
      layers[1].challenging = [{ evidence_id: 'synthetic-legacy-challenge', player: '合成舊版反方', source: { path: 'synthetic-legacy-row.md', line: 10 } }]
      layers[1].unknown = [{ evidence_id: 'synthetic-legacy-unknown', player: '合成舊版未知' }, '合成舊版方向未明原文']
      layers[0].unlinked_evidence = []; layers[0].unlinked_players = []
      data.narratives[0].thesis_evidence.unlinked_evidence.push({ evidence_id: 'synthetic-global-only', pillar_id: layers[0].pillar_id, player: '合成同層全域列', limitations: ['合成全域列仍未連結'], source: { path: 'synthetic-global-only.md', line: 13 } })
    }
    if (data?.brief) {
      if (scenario === 'initial-error' || window.__failBrief) throw new Error('Synthetic read failure')
      if (scenario === 'blank-summary') data.today.timeline = []
      if (scenario === 'news-without-timeline') {
        data.today.timeline = []
        data.brief.headline = ''
        data.brief.events = [{ story_id: 'synthetic-no-timeline', event: '合成無時間軸事件', market_reaction: '', interpretation: '', impact: '', today: '' }]
        data.brief.market_observations = []
        data.brief.event_notes = []
        data.today.market_observations = []
        data.today.intraday_refresh.market_observations = []
      }
      if (scenario === 'market-only-no-timeline') {
        data.today.timeline = []
        data.brief.headline = ''
        data.brief.events = []
        data.brief.market_observations = []
        data.brief.event_notes = []
        data.today.market_observations = []
        data.today.intraday_refresh.market_observations = []
      }
      if (scenario === 'market-observation-only-duplicate-timeline') {
        const observation = { information_kind: 'market_observation', market: 'tw', event: '合成唯一盤中市場觀察', observation_value: '虛構盤中讀數 0.9%', observed_at: '2026-09-30T09:10:00+08:00', source_path: 'synthetic/only-intraday-market.md' }
        data.brief.market_observations = []
        data.today.market_observations = []
        data.today.timeline = [{ ...observation, kind: 'update', at: observation.observed_at, timeline_at: observation.observed_at, summary: '合成時間軸額外摘要。', id: 'synthetic-only-market-update', story_id: null, portfolio_impact: '', action: '', relevance: [] }]
        data.today.intraday_refresh.market_observations = [observation]
      }
      if (scenario === 'market-observation-only-projection-error') {
        const observation = { information_kind: 'market_observation', market: 'tw', event: '合成無時間的盤中市場觀察', observation_value: '虛構盤中讀數 0.6%', source_path: 'synthetic/sparse-intraday-market.md' }
        data.brief.headline = ''
        data.brief.events = []
        data.brief.market_observations = []
        data.brief.event_notes = []
        data.today.updates = []
        data.today.market_observations = []
        data.today.timeline = [{ ...observation, kind: 'update', at: '2026-09-30T09:10:00+08:00', timeline_at: '2026-09-30T09:10:00+08:00', summary: '合成時間軸包裝摘要。', id: 'synthetic-sparse-market-update', story_id: null, portfolio_impact: '', action: '', relevance: [] }]
        data.today.intraday_refresh.market_observations = [observation]
      }
      if (scenario === 'blank-summary') {
        data.today.updates[0].summary = '   '
        data.today.updates[0].portfolio_impact = '更正為 2%，原判斷需下修。'
      }
      if (scenario === 'unlinked-long') {
        data.brief.state = 'stale'
        data.brief.source_cutoff = null
        data.brief.headline = '合成長標題：' + 'LongUnbrokenEvidence'.repeat(18)
        data.brief.thesis_changes = [
          { thesis: '合成未關聯判斷', event_index: null, event_ref: '', change: '轉弱', reason: '缺少新證據，並非維持不變。' },
          { thesis: '合成越界判斷', event_index: 999, event_ref: '', change: '待驗證', reason: '應保留內容，不猜測新聞關聯。' }
        ]
        data.brief.risks = [{ risk: '合成缺少關聯的風險', status: '仍待確認', event_ref: '' }]
        data.brief.actions = ['觀察 5%', '觀察 5%', '觀察 6%', '不加碼', '加碼']
        data.brief.action_items = []
      }
      if (scenario === 'missing') {
        data.brief.state = 'missing'
        data.brief.headline = ''
        data.brief.source = null
        data.brief.action_items = []
        data.brief.envelope = null
        data.today = { state: 'unavailable', decision_summary: null, updates: [], limitations: [] }
        for (const key of ['actions', 'events', 'event_notes', 'thesis_changes', 'thesis_notes', 'risks', 'risk_notes', 'upcoming', 'upcoming_notes', 'market_pulse', 'market_pulse_notes']) data.brief[key] = []
      }
      if (scenario === 'actions-partial') {
        data.brief.state = 'current'
        data.brief.actions = []
        data.brief.action_items = []
        data.brief.judgment = null
        data.brief.source = null
        data.brief.envelope = { ...data.brief.envelope, completeness: 'partial', limitations: [] }
        data.today = { state: 'ready', decision_summary: null, updates: [], limitations: [] }
      }
      if (scenario === 'research-only') {
        data.brief.state = 'current'
        data.brief.actions = []
        data.brief.judgment = null
        data.brief.action_items = [{ id: 'synthetic-research-only', text: '補研究：核對合成公開資料', status: 'open', tickers: [], evidence: [], artifact_id: 'synthetic-brief', source: 'daily-brief', date: '2026-09-24' }]
        data.brief.source = null
        data.brief.envelope = { ...data.brief.envelope, completeness: 'ready', limitations: [] }
        data.today = { state: 'ready', decision_summary: null, updates: [], limitations: [] }
      }
      if (scenario === 'session-tw') {
        data.brief.session = 'tw-open-prep'
        data.brief.generated_at = `${data.brief.date}T08:20:00+08:00`
        data.brief.source_cutoff = `${data.brief.date}T08:00:00+08:00`
        data.brief.envelope.generated_at = data.brief.generated_at
        data.brief.envelope.source_cutoff = data.brief.source_cutoff
      }
      if (scenario === 'session-stale-us') {
        data.brief.state = 'stale'
        data.brief.source.state = 'stale'
        data.brief.date = '2026-09-29'
        data.brief.generated_at = '2026-09-29T21:40:00+08:00'
        data.brief.source_cutoff = '2026-09-29T21:20:00+08:00'
        data.brief.source.date = data.brief.date
        data.brief.source.generated_at = data.brief.generated_at
        data.brief.source.source_cutoff = data.brief.source_cutoff
        data.brief.envelope.generated_at = data.brief.generated_at
        data.brief.envelope.source_cutoff = data.brief.source_cutoff
        data.brief.actions = ['觀察：跨日後仍保留最新簡報中的行動。']
        data.brief.action_items = []
        data.brief.judgment = null
        data.today = { ...data.today, state: 'ready', decision_summary: null, updates: [] }
      }
      if (scenario === 'session-missing') data.brief.session = null
      if (scenario === 'session-malformed-times') {
        data.brief.date = '2026-02-30'
        data.brief.generated_at = '2026-09-25T99:99:99Z'
        data.brief.source_cutoff = null
      }
    }
    if (Array.isArray(data?.markets)) {
      if (['market-empty-refetch', 'market-omitted-refetch'].includes(scenario)) {
        const tw = data.markets.find(m => m.market === 'tw')
        if (tw) { tw.as_of = '2001-02-03'; tw.source_cutoff = '2001-02-03T13:30:00+08:00' }
        if (window.__cachedReadFailure) {
          data.state = scenario === 'market-empty-refetch' ? 'unavailable' : 'partial'
          data.markets = scenario === 'market-empty-refetch' ? [] : data.markets.filter(m => m.market !== 'tw')
        }
      }

      if (scenario === 'market-initial-error' || (scenario === 'market-refresh-error' && window.__failMarketExplore)) throw new Error('Synthetic market explore failure')
      if (scenario === 'market-refresh-delayed' && window.__delayMarketExplore) await new Promise(resolve => setTimeout(resolve, 600))
      if (scenario === 'market-refresh-unavailable' && window.__marketUnavailable) {
        data.state = 'partial'
        const tw = data.markets.find(market => market.market === 'tw')
        tw.state = 'unavailable'
        for (const bucket of tw.buckets) bucket.items = []
        const us = data.markets.find(market => market.market === 'us')
        us.state = 'ready'
        us.buckets[0].items = [{ symbol: 'SYNTH-US-CONTEXT', label: '合成美股探索甲', price: 123, change_1d_pct: 1, change_7d_pct: 2, activity: { label: 'relative_volume', value: 1.2 }, rsi14: null, vs_50ma_pct: null, rs_benchmark_1m_pp: null, rs_benchmark_window: null, researched: false }]
      }
      if (scenario === 'market-cached-unavailable') {
        data.state = 'unavailable'
        const clearCachedSnapshot = Boolean(window.__clearMarketCache)
        data.cached = !clearCachedSnapshot
        data.message = 'Synthetic market snapshot is cached'
        const tw = data.markets.find(market => market.market === 'tw')
        tw.as_of = '2001-02-03'
        tw.source_cutoff = '2001-02-03T13:30:00+08:00'
        if (clearCachedSnapshot) {
          tw.state = 'unavailable'
          for (const bucket of tw.buckets) bucket.items = []
        }
        const us = data.markets.find(market => market.market === 'us')
        us.state = 'unavailable'
        for (const bucket of us.buckets) bucket.items = []
      }
      if (scenario === 'market-empty') {
        data.state = 'ready'
        data.cached = false
        for (const market of data.markets) {
          market.state = 'ready'
          for (const bucket of market.buckets) bucket.items = []
        }
      }
      if (scenario === 'market-unavailable') {
        data.state = 'unavailable'
        data.cached = false
        data.message = ''
        for (const market of data.markets) {
          market.state = 'unavailable'
          for (const bucket of market.buckets) bucket.items = []
        }
      }
      if (scenario === 'market-mixed-dates') {
        const tw = data.markets.find(market => market.market === 'tw')
        tw.as_of = '2001-02-03'
        tw.source_cutoff = '2001-02-03T13:30:00+08:00'
      }
    }
    if (scenario === 'market-mixed-dates' && data?.index && data?.breadth) {
      data.as_of = '2001-01-02'
      data.requested_date = '2001-01-03'
      data.source_dates = { twse: '2001-01-02', tpex: '2001-01-03' }
      data.generated_at = '2001-03-04T12:00:00+08:00'
      data.source_cutoff = '2001-01-02T13:30:00+08:00'
    }
    if (scenario === 'market-known-breadth-no-ratio' && data?.index && data?.breadth) {
      data.state = 'partial'
      data.breadth.advancer_ratio = null
      data.breadth.combined.up = 7
      data.breadth.combined.down = 5
      data.breadth.combined.flat = 2
    }
    if (scenario === 'market-mixed-dates' && Array.isArray(data?.items) && data.items.some(item => item && item.market)) {
      const tw = data.items.find(item => item.market === 'tw')
      tw.quoted_at = '2001-05-06T09:30:00+08:00'
    }
    if (scenario === 'quote-unavailable' && Array.isArray(data?.items) && data.items.some(item => item && 'quoted_at' in item)) {
      const item = data.items.find(item => item && 'quoted_at' in item)
      item.state = 'unavailable'
      item.value = null
      item.change = null
      item.change_percent = null
      item.quoted_at = null
    }
    return data
  }
}, { scenario, judgmentFixture, claimFixture, intradayFixture })
}
async function openPage(width, scenario = 'baseline') {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  page.setDefaultTimeout(7000)
  const errors = [], externalRequests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!request.url().startsWith(origin)) externalRequests.push(request.url()) })
  await fault(page, scenario)
  await page.goto(`${origin}/?tab=investment`, { waitUntil: 'networkidle' })
  return { page, errors, externalRequests }
}
try {
  for (const width of [1440, 390]) {
    for (const outcome of ['mixed', 'unknown', 'partial', 'read-failed', 'missing-formal']) {
      const scenario = `intraday-${outcome}`
      const { page, errors, externalRequests } = await openPage(width, scenario)
      const panel = page.locator('#investment-panel-today')
      const reading = panel.getByRole('region', { name: '盤中更新', exact: true })
      await reading.waitFor()
      if (outcome === 'read-failed') {
        await page.evaluate(() => { window.__failBrief = true })
        await page.getByRole('button', { name: '台股消息快掃', exact: true }).click()
        await reading.getByRole('status').filter({ hasText: /本次盤中資料未確認/ }).waitFor()
      }
      const main = await reading.innerText()
      assert.match(main, /合成較新深掃：維護成本尚待確認/)
      assert.match(main, /合成持倉影響：續約資料仍不足以回答成本問題/)
      assert.match(main, /合成來源提醒：下一次成本公告再核對/)
      assert.match(main, /台股 · 來源標示持倉深掃/)
      assert.match(main, /美股 · 消息快掃/)
      assert.match(main, /合成盤中指數讀數/)
      assert.doesNotMatch(main, /狀態未提供|與正式判斷的關係未說明|synthetic-deep-latest|story_id/)
      assert.equal(await panel.getByRole('region', { name: '盤中市場讀數', exact: true }).count(), 1)
      assert.equal(await panel.getByRole('group', { name: '盤中補充觀察', exact: true }).count(), 0)
      assert.ok((await panel.getByRole('region', { name: '今天怎麼做', exact: true }).boundingBox()).y < (await reading.boundingBox()).y)
      if (outcome === 'unknown') {
        assert.match(main, /合成時間與模式未知的來源內容/)
        assert.match(main, /盤中來源更新（模式未提供）/)
        assert.doesNotMatch(main, /較早盤中紀錄/)
      } else {
        assert.doesNotMatch(main, /合成較早深掃摘要|合成較早來源提醒/)
        const older = reading.getByText('較早盤中紀錄 · 1', { exact: true }).locator('..')
        assert.equal(await older.getAttribute('open'), null)
        await older.evaluate(element => { element.open = true })
        assert.match(await reading.innerText(), /合成較早深掃摘要|合成較早來源提醒/)
        await older.evaluate(element => { element.open = false })
      }
      if (outcome === 'partial') assert.match(main, /盤中資料部分可用|部分來源完成/)
      if (outcome === 'missing-formal') assert.match(await panel.innerText(), /尚未取得正式簡報/)
      if (outcome === 'mixed') assert.doesNotMatch(await panel.getByRole('region', { name: '今天怎麼做', exact: true }).innerText(), /判斷已更新|合成較新深掃/)
      await reading.screenshot({ path: `${output}/${scenario}-${width}.png` })
      await expand(reading)
      assert.match(await reading.innerText(), /synthetic-deep-latest|市場日期：待核對/)
      if (outcome === 'unknown') assert.match(await reading.innerText(), /來源未標明快掃或深掃，不推定掃描範圍/)
      const measured = await layout(page, `${scenario}-${width}`)
      assert.deepEqual(errors, [])
      assert.deepEqual(externalRequests, [])
      report.scenarios.push({ name: `${scenario}-${width}`, ...measured, errors, externalRequests })
      await page.close()
    }
  }
  for (const width of [1440, 390]) {
    for (const outcome of ['pending', 'no-request', 'running', 'failed', 'partial', 'quiet']) {
      const scenario = `operations-${outcome}`
      const { page, errors, externalRequests } = await openPage(width, scenario)
      const operations = page.locator('div[aria-label="更新狀態與紀錄"]')
      const disclosure = operations.locator('details').first()
      assert.equal(await disclosure.getAttribute('open'), null)
      const collapsed = await operations.innerText()
      assert.doesNotMatch(collapsed, /Synthetic technical|partial\/null|Antigravity|synthetic-model|synthetic-provider-error|總耗時|無影響當前判斷的新消息|沒有重要增量|資料截止時間已更新/)
      assert.equal(await operations.getByRole('status').count(), ['running', 'failed', 'partial'].includes(outcome) ? 1 : 0)
      if (outcome === 'running') assert.match(collapsed, /進行中/)
      if (outcome === 'failed') assert.match(collapsed, /盤面更新失敗|台股快掃失敗/)
      if (outcome === 'partial') assert.match(collapsed, /盤面更新部分完成|台股快掃部分完成/)
      const main = await page.locator('main').innerText()
      if (outcome === 'quiet') {
        assert.equal((main.match(/快掃未發現重要新事件/g) || []).length, 1)
        assert.doesNotMatch(main, /無影響當前判斷的新消息|沒有影響判斷的新消息/)
      }
      const judgment = page.getByRole('region', { name: '今天怎麼做', exact: true })
      assert.match(await judgment.innerText(), /合成灌溉設備：訂單能否變成持續收入，仍需確認。/)
      assert.ok((await judgment.boundingBox()).y < 700, 'completed operation records do not push judgment below the first screen')
      await page.screenshot({ path: `${output}/${scenario}-${width}.png`, fullPage: false })
      await disclosure.evaluate(element => { element.open = true })
      if (outcome !== 'pending') {
        const expanded = await operations.innerText()
        assert.match(expanded, /Synthetic technical partial\/null sync adapter record/)
        assert.match(expanded, /2001-02-03T10:00:34\+08:00|synthetic-model|synthetic-provider-error/)
      }
      await page.getByRole('tab', { name: '我的判斷', exact: true }).click()
      assert.equal(await operations.isVisible(), true, 'operational receipts remain accessible on other investment tabs')
      assert.equal(await disclosure.getAttribute('open'), '')
      assert.deepEqual(errors, [])
      assert.deepEqual(externalRequests, [])
      report.scenarios.push({ name: `${scenario}-${width}`, ...await layout(page, `${scenario}-${width}`), errors, externalRequests })
      await page.close()
    }
  }
  for (const width of [1440, 390, 320]) {
    const { page, errors, externalRequests } = await openPage(width)
    const steps = page.getByRole('region', { name: '今天怎麼做', exact: true })
    await steps.waitFor()
    assert.equal(await steps.getByLabel('主要下一步').count(), 1)
    assert.equal(await steps.getByText('檢查點與來源', { exact: true }).locator('..').getAttribute('open'), null)
    const actionTop = await steps.boundingBox()
    const newsTop = await page.getByRole('region', { name: '今天發生了什麼', exact: true }).boundingBox()
    assert.ok(actionTop.y < newsTop.y, 'action precedes news')
    assert.ok(actionTop.y < 1000, 'next step starts in first screen')
    assert.equal(await page.getByLabel('今日個人提醒').count(), 0)
    const holdings = page.getByRole('region', { name: '持倉行情與動能', exact: true })
    await holdings.getByRole('button', { name: /^DEMO\b/ }).first().waitFor()
    const listed = holdings.locator('[data-tw-rs-symbol="DEMO-TW-A.TW"]')
    await listed.getByText(/\+3.25%/).waitFor()
    assert.match(await listed.innerText(), /對 \^TWII/)
    assert.match(await listed.innerText(), /60 交易日 · 2026-09-19/)
    const listedRow = listed.locator('xpath=ancestor::li[1]')
    await listedRow.getByRole('button').click()
    assert.match(await listedRow.innerText(), /比較窗口 2026-06-24 至 2026-09-19/)
    assert.match(await listedRow.innerText(), /要求日期 2026-09-20/)
    assert.match(await holdings.locator('[data-tw-rs-symbol="DEMO-TW-B.TWO"]').innerText(), /此標的來源不可用/)
    const missing = holdings.locator('[data-tw-rs-symbol="DEMO-TW-C.TW"]')
    assert.match(await missing.innerText(), /基準未提供/)
    assert.doesNotMatch(await missing.innerText(), /99|\+.*%/)
    const marketTabs = page.getByRole('tablist', { name: '市場', exact: true })
    await marketTabs.getByRole('tab', { name: '台股', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await marketTabs.getByRole('tab', { name: '美股', exact: true }).getAttribute('aria-selected'), 'true')
    await page.keyboard.press('Home')
    assert.equal(await marketTabs.getByRole('tab', { name: '台股', exact: true }).getAttribute('aria-selected'), 'true')
    for (const label of tabs) {
      await page.getByRole('tab', { name: label, exact: true }).click()
      const panel = page.getByRole('tabpanel').filter({ visible: true }).first()
      if (label === '我的判斷') {
        await panel.getByRole('heading', { name: '目前判斷', exact: true }).waitFor()
        assert.match(await panel.innerText(), /來源關聯不一致/)
        assert.equal(await panel.getByText('資料狀態說明', { exact: true }).first().locator('..').getAttribute('open'), null)
        const overview = await panel.getByRole('article', { name: '目前判斷', exact: true }).boundingBox()
        const claims = await panel.getByRole('article', { name: '主張與證據', exact: true }).boundingBox()
        assert.ok(overview && claims && overview.y < claims.y, 'current judgment precedes evidence')
        assert.equal(await panel.getByTestId('judgment-layers').getAttribute('open'), null)
        assert.equal(await panel.getByTestId('judgment-signals').getAttribute('open'), null)
      }
      if (label === '研究與策略') {
        const catalysts = panel.getByRole('region', { name: '未來 30 天催化劑', exact: true })
        const research = panel.getByRole('region', { name: '正式 Research', exact: true })
        await research.waitFor()
        assert.ok((await catalysts.boundingBox()).y < (await research.boundingBox()).y)
        assert.equal(await research.getByTestId('research-direction').count(), 5)
        assert.equal(await research.getByTestId('research-other').getAttribute('open'), null)
        assert.match(await research.getByTestId('research-other').innerText(), /2 \/ 7 項/)
        assert.match(await panel.getByRole('group', { name: 'Investment Note 未結案的行動', exact: true }).innerText(), /尚未結案 · 1 項[\s\S]*已有判斷頁可承接 · 1 項/)
        assert.equal(await panel.getByTestId('investment-system-status').getAttribute('open'), null)
        assert.match(await panel.innerText(), /尚未提供|不推定/)
        assert.ok((await panel.getByRole('region', { name: '待處理', exact: true }).boundingBox()).y > (await research.boundingBox()).y)
      }
      const collapsed = await layout(page, `${width}/${label}`)
      await expand(panel)
      const expanded = await layout(page, `${width}/${label}/expanded`)
      if (label === '我的判斷') {
        const judgmentText = await panel.innerText()
        assert.match(judgmentText, /合成層的目前認知。/)
        assert.match(judgmentText, /AI 整理・2026-09-27・依據：合成依據（2026-09-20）/)
        assert.match(judgmentText, /還缺：合成缺口｜合成季報・預計 2026-10/)
        assert.match(judgmentText, /支持 0 筆・挑戰 0 筆・反方：還沒查/, 'old producer keeps its status line')
        assert.match(judgmentText, /目前認知的來源與限制/)
        assert.match(judgmentText, /合成案例示範 partial reading 仍可直接閱讀/)
        assert.match(judgmentText, /合成買方甲/)
        assert.match(judgmentText, /合成買方乙/)
        assert.match(judgmentText, /來源的全域未連結資料/)
        assert.match(judgmentText, /synthetic-unmapped-evidence/)

        assert.match(await panel.innerText(), /訊號日期：\s*未提供/)
        assert.match(await panel.innerText(), /文件更新日：\s*2026-09-19/)
        assert.match(await panel.innerText(), /synthetic-challenge-signal.md.*15/)
      }
      if (label === '研究與策略') assert.match(await panel.innerText(), /未連結 1 項；其餘 1 項的方向未知/)
      if (label === '復盤與學習') {
        assert.match(await panel.innerText(), /範例研究 B：判斷、後續結果與心得/)
        assert.match(await panel.innerText(), /後續結果未知/)
      }
      await page.screenshot({ path: `${output}/${width}-${label}.png`, fullPage: true })
      report.pages.push({ width, tab: label, collapsed, expanded })
    }
    await page.getByRole('tab', { name: 'Today', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.getByRole('tab', { name: '我的判斷', exact: true }).getAttribute('aria-selected'), 'true')
    await page.keyboard.press('End')
    assert.equal(await page.getByRole('tab', { name: '復盤與學習', exact: true }).getAttribute('aria-selected'), 'true')
    await page.keyboard.press('Home')
    assert.equal(await page.getByRole('tab', { name: 'Today', exact: true }).getAttribute('aria-selected'), 'true')
    assert.deepEqual(errors, [])
    assert.deepEqual(externalRequests, [])
    await page.close()
  }
  // User-facing before/after read-back, at both reading and narrow widths.
  for (const width of [1080, 390]) {
    for (const scenario of ['judgment-ready', 'claim-ready', 'judgment-change', 'claim-relations']) {
      const { page, errors, externalRequests } = await openPage(width, scenario)
      let section = page.getByRole('region', { name: '今天怎麼做', exact: true })
      if (scenario.startsWith('claim-')) {
        await page.getByRole('tab', { name: '我的判斷', exact: true }).click()
        section = page.getByRole('article', { name: '主張與證據', exact: true })
      }
      await section.waitFor()
      if (scenario.endsWith('-ready')) {
        const normalText = await section.innerText()
        assert.doesNotMatch(normalText, /合成長文|這段是合成長文/)
        if (scenario === 'claim-ready') {
          assert.match(normalText, /來源標示目前有效/)
          assert.doesNotMatch(normalText, /來源目前不可用|尚未重新確認目前狀態/)
        } else assert.match(normalText, /10:00 重評判斷 · 10:00 快掃有新增事件/)
        await page.screenshot({ path: `${output}/${scenario}-${width}-full.png`, fullPage: true })
      }
      await section.screenshot({ path: `${output}/${scenario}-${width}.png` })
      assert.deepEqual(errors, [])
      assert.deepEqual(externalRequests, [])
      report.scenarios.push({ name: `${scenario}-${width}`, ...await layout(page, `${scenario}-${width}`), errors, externalRequests })
      await page.close()
    }
  }
  // Preserve legacy degraded-state scenarios, now checked against the converged owner layout.
  const scenarios = ['claim-unavailable', 'judgment-quiet-partial', 'judgment-quiet-unknown', 'claim-relations', 'claim-missing', 'claim-empty', 'judgment-change', 'judgment-unchanged', 'judgment-quiet', 'judgment-failed', 'judgment-stale', 'judgment-mismatch', 'unlinked-long', 'blank-summary', 'missing', 'news-without-timeline', 'market-only-no-timeline', 'market-observation-only-duplicate-timeline', 'market-observation-only-projection-error', 'actions-partial', 'research-only', 'initial-error', 'refresh-error', 'refresh-partial-news', 'quote-unavailable', 'narrative-stale-partial', 'narrative-delayed', 'market-empty', 'market-unavailable', 'market-cached-unavailable', 'market-initial-error', 'market-refresh-error', 'market-refresh-delayed', 'market-refresh-unavailable', 'market-mixed-dates', 'market-known-breadth-no-ratio', 'market-observation-legacy-timeline', 'market-observation-event-projection', 'session-tw', 'session-stale-us', 'session-missing', 'session-malformed-times', 'watch-read-error', 'watch-eligibility', 'tw-rs-unavailable', 'tw-rs-read-error', 'structured-judgment', 'structured-judgment-generic-action', 'structured-judgment-multiple-primary', 'structured-judgment-invalid-watch', 'structured-judgment-invalid-provenance', 'layer-reading', 'quote-cached-error', 'pulse-cached-error', 'market-empty-refetch', 'market-omitted-refetch', 'legacy-evidence']
  for (const scenario of scenarios) {
    console.log(`Checking ${scenario}`)
    const { page, errors, externalRequests } = await openPage(320, scenario)
    let panel = page.locator('#investment-panel-today')
    if (['quote-cached-error', 'pulse-cached-error', 'market-empty-refetch', 'market-omitted-refetch'].includes(scenario)) {
      await page.getByText('島嶼設備甲', { exact: true }).first().waitFor()
      await page.evaluate(() => { window.__cachedReadFailure = true })
      await page.getByRole('button', { name: '刷新盤面', exact: true }).click()
      await page.waitForTimeout(750)
    }
    if (['refresh-error', 'market-refresh-error', 'market-refresh-delayed', 'market-refresh-unavailable', 'market-cached-unavailable'].includes(scenario)) {
      await page.evaluate(scenario => {
        window.__failBrief = scenario === 'refresh-error'
        window.__failMarketExplore = scenario === 'market-refresh-error'
        window.__delayMarketExplore = scenario === 'market-refresh-delayed'
        window.__marketUnavailable = scenario === 'market-refresh-unavailable'
        window.__clearMarketCache = scenario === 'market-cached-unavailable'
      }, scenario)
      await page.getByRole('button', { name: scenario === 'refresh-error' ? '台股消息快掃' : '刷新盤面', exact: true }).click()
      await page.waitForTimeout(750)
    }
    if (scenario.startsWith('claim-') || scenario.startsWith('narrative-') || scenario === 'layer-reading' || scenario === 'legacy-evidence') {
      await page.getByRole('tab', { name: '我的判斷', exact: true }).click()
      panel = page.locator('#investment-panel-thesis')
      await panel.getByRole('heading', { name: '目前判斷', exact: true }).waitFor()
    }
    if (scenario.startsWith('watch-')) {
      await page.getByRole('tab', { name: '研究與策略', exact: true }).click()
      panel = page.locator('#investment-panel-work')
      await panel.getByRole('region', { name: '我的提醒', exact: true }).waitFor()
      if (scenario === 'watch-read-error') await panel.getByRole('alert').filter({ hasText: /讀取失敗/ }).first().waitFor()
      else {
        await panel.getByText('Synthetic due-today', { exact: true }).waitFor()
        assert.doesNotMatch(await panel.getByRole('region', { name: '我的提醒', exact: true }).innerText(), /Synthetic completed/)
      }
    }
    const actionSectionLabel = scenario === 'session-stale-us' ? '目前可用行動' : scenario === 'refresh-error' ? '今天怎麼做' : null
    if (actionSectionLabel) {
      await panel.locator(`section[aria-label="${actionSectionLabel}"]`).screenshot({ path: `${output}/${scenario}-action-card.png` })
    }
    if (scenario.startsWith('judgment-')) {
      const steps = panel.getByRole('region', { name: /今天怎麼做|目前可用行動/ })
      const collapsed = await steps.innerText()
      assert.doesNotMatch(collapsed, /資料截至|本次查核：|這次提高了對當季收入的把握|本次查核範圍內沒有重要增量，沿用先前判斷/)
      const metadata = steps.getByRole('note', { name: '正式判斷時間與後續快掃', exact: true })
      assert.equal(await metadata.locator('p').count(), 0, 'time and scan status are one caption')
      const primary = steps.getByLabel('主要下一步', { exact: true })
      const primaryBox = await primary.boundingBox()
      const metadataBox = await metadata.boundingBox()
      assert.ok(primaryBox.y + primaryBox.height <= metadataBox.y, 'authored judgment precedes time and scan status')
      if (scenario === 'judgment-quiet') assert.match(await metadata.innerText(), /08:01 台股晨報判斷 · 10:00 快掃未發現重要新事件/)
      if (scenario === 'judgment-quiet-partial') assert.match(await metadata.innerText(), /快掃僅部分完成，沿用判斷/)
      if (scenario === 'judgment-failed') assert.match(await metadata.innerText(), /快掃失敗，沿用判斷/)
      await panel.getByRole('region', { name: /今天怎麼做|目前可用行動/ }).screenshot({ path: `${output}/${scenario}-320.png` })
    }
    await page.getByText('更新紀錄與來源回執', { exact: true }).locator('..').evaluate(element => { element.open = true })
    await expand(panel)
    const text = await panel.innerText()
    const todaySteps = scenario.startsWith('structured-judgment')
      ? await page.locator('#investment-panel-today section[aria-label="今天怎麼做"]').innerText()
      : ''
    switch (scenario) {
      case 'claim-unavailable': {
        const claimText = await panel.getByRole('article', { name: '主張與證據', exact: true }).innerText()
        assert.doesNotMatch(claimText, /來源標示目前有效/)
        assert.match(claimText, /尚未重新確認/)
        assert.match(claimText, /支持此主張/)
        break
      }
      case 'judgment-quiet-partial':
      case 'judgment-quiet-unknown': {
        const receipt = await page.getByRole('region', { name: '台美盤中刷新回執', exact: true }).innerText()
        assert.match(receipt, /不能確認有無重要增量|完整度未確認/)
        assert.doesNotMatch(receipt, /此次掃描範圍內沒有重要增量|完成，沒有重大更新/)
        assert.match(text, /本次無法確認，保留既有判斷/)
        assert.doesNotMatch(text, /本次查核：/)
        break
      }
      case 'claim-relations': {
        const claim = panel.getByRole('article', { name: '主張與證據', exact: true })
        assert.match(await claim.innerText(), /支持此主張/)
        assert.match(await claim.innerText(), /挑戰此主張/)
        assert.match(await claim.innerText(), /對此主張有混合影響/)
        assert.match(await claim.innerText(), /歷史資料，來源已過期/)
        assert.match(await claim.innerText(), /不代表目前仍然成立/)
        assert.equal(await claim.locator('[data-claim-direction="mixed"]').count(), 1)
        assert.equal(await claim.getByRole('link', { name: /查看這筆證據來源/ }).count(), 3)
        break
      }
      case 'claim-missing': assert.match(text, /來源尚未提供證據與主張的關係資料/); break
      case 'claim-empty': assert.match(text, /來源明確列出零筆已對應的關係/); break
      case 'judgment-change':
        assert.match(text, /判斷已更新 · 行動仍是觀察/)
        assert.match(text, /原先判斷 · 正式簡報/)
        assert.match(text, /相較原先，多知道什麼/)
        assert.match(text, /未来|未來三年的維修成本/)
        break
      case 'judgment-unchanged':
        assert.match(text, /已重評，判斷維持不變/)
        assert.match(text, /有新增續約資料，但觀察時間仍短/)
        break
      case 'judgment-quiet':
        assert.match(await page.getByRole('region', { name: '台美盤中刷新回執', exact: true }).innerText(), /此次掃描範圍內沒有重要增量/)
        assert.match(text, /沿用既有判斷/)
        break
      case 'judgment-failed':
      case 'judgment-stale':
      case 'judgment-mismatch':
        assert.match(text, /本次無法確認，保留既有判斷/)
        assert.doesNotMatch(text, /判斷已更新 · 行動仍是觀察|本次查核：/)
        break
      case 'unlinked-long':
        assert.match(text, /合成未關聯判斷|缺少新證據/)
        assert.match(text, /合成越界判斷|應保留內容/)
        assert.match(text, /合成缺少關聯的風險/)
        assert.match(text, /較早的簡報|不把舊判斷/)
        break
      case 'blank-summary': assert.match(text, /這筆更新未提供摘要[\s\S]*更正為 2%/); break
      case 'missing': assert.match(text, /本次來源沒有可讀的事件；不代表沒有新聞/); assert.match(text, /資料缺失不代表今天不用動/); break
      case 'news-without-timeline':
        assert.equal(await panel.locator('div.flex.flex-col.gap-3.p-4').filter({ hasText: '合成無時間軸事件' }).count(), 1, 'the available event projection renders once without a timeline')
        assert.doesNotMatch(text, /尚未取得可讀的今日變化/)
        break
      case 'market-only-no-timeline': {
        const formalReadings = panel.getByRole('region', { name: '正式簡報與事件讀回的市場讀數', exact: true })
        assert.equal(await formalReadings.count(), 1)
        assert.equal(await formalReadings.evaluate(element => element.nextElementSibling?.classList.contains('divide-y') ?? false), false, 'formal readings do not create an empty duplicate card')
        break
      }
      case 'market-observation-only-duplicate-timeline':
        assert.equal(await panel.getByRole('region', { name: '盤中市場讀數', exact: true }).count(), 1)
        assert.equal(await panel.getByText('簡報版次與掃描時間軸', { exact: true }).count(), 0, 'a filtered duplicate cannot leave an empty expandable timeline')
        break
      case 'market-observation-only-projection-error':
        assert.equal(await panel.getByRole('region', { name: '盤中市場讀數', exact: true }).count(), 1)
        assert.match(text, /合成無時間的盤中市場觀察/)
        assert.doesNotMatch(text, /尚未取得可讀的今日變化/)
        assert.equal(await panel.getByText('簡報版次與掃描時間軸', { exact: true }).count(), 1, 'a sparse timeline wrapper stays in source history without a complete observation identity')
        break
      case 'actions-partial': assert.match(text, /沒有可確認的下一步/); assert.doesNotMatch(text, /今天不用動。/); break
      case 'research-only': assert.match(text, /補研究：核對合成公開資料/); break
      case 'initial-error': assert.match(text, /簡報讀取失敗/); assert.equal(await panel.getByLabel('主要下一步').count(), 0); assert.doesNotMatch(text, /Today 讀回未提供台美分市場增量回執/); assert.match(text, /10\/12｜虛構記憶體（SYNTH）｜Q3 線上法說[\s\S]*時間 15:00/); break
      case 'refresh-error': {
        assert.equal(await panel.getByLabel('主要下一步').count(), 1)
        assert.match(text, /本次簡報讀取失敗；以下保留上次成功讀到的簡報與行動/)
        const receipts = page.getByRole('region', { name: '台美盤中刷新回執', exact: true })
        assert.match(await receipts.innerText(), /本次簡報重讀失敗；以下保留上次成功讀到的回執，不代表目前狀態/)
        assert.match(await page.locator('main').innerText(), /讀取失敗|更新失敗|本次更新失敗/)
        assert.match(text, /收盤前再看一次量能是否延續/)
        break
      }
      case 'refresh-partial-news': {
        const payload = await page.evaluate(() => window.__partialRefreshPayload)
        assert.equal(payload.state, 'partial')
        assert.equal(payload.provider, 'agy')
        assert.equal(payload.model_work_state, null)
        assert.equal(payload.new_update_count, null)
        const status = page.getByRole('status').filter({ hasText: /美股快掃部分完成/ })
        await status.waitFor()
        assert.equal(await status.evaluate(element => element.classList.contains('text-warn')), true)
        const statusText = await status.innerText()
        assert.doesNotMatch(statusText, /由 Antigravity|合成快掃部分完成，來源覆蓋仍不完整/)
        const operationDetails = page.getByText('更新紀錄與來源回執', { exact: true }).locator('..')
        assert.match(await operationDetails.innerText(), /由 Antigravity 執行狀態未知/)
        assert.match(text, /美股快掃 21:20：部分完成，結果不完整/)
        assert.doesNotMatch(text, /美股快掃 21:20：沒有影響判斷的新消息|美股快掃 21:20：已完成/)
        break
      }
      case 'quote-unavailable': assert.match(text, /未取得|—/); break
      case 'narrative-stale-partial': assert.match(text, /來源較舊/); assert.match(text, /五層證據覆蓋仍不完整/); break
      case 'narrative-delayed': assert.match(text, /目前判斷/); break
      case 'market-empty': assert.match(text, /本次完整掃描沒有符合條件的標的/); break
      case 'market-unavailable': assert.match(text, /台股探索資料目前無法取得；不代表沒有符合標的/); break
      case 'market-cached-unavailable': assert.match(text, /先前快照[\s\S]*島嶼設備甲/); assert.match(text, /2001[-/]02[-/]03/); break
      case 'market-initial-error': assert.match(text, /這次無法取得市場探索資料；不把缺值當成沒有符合標的/); break
      case 'market-refresh-error': assert.match(text, /市場探索更新失敗/); assert.match(text, /島嶼設備甲/); break
      case 'market-refresh-delayed': assert.match(text, /合成台股指數/); assert.match(text, /島嶼設備甲/); break
      case 'market-refresh-unavailable':
        assert.match(text, /先前快照[\s\S]*島嶼設備甲/)
        await page.getByRole('tab', { name: '美股', exact: true }).click()
        await page.getByText('合成美股探索甲', { exact: true }).waitFor()
        break
      case 'market-mixed-dates': assert.match(text, /TWSE 行情日：2001[-/]01[-/]02 · TPEx 行情日：2001[-/]01[-/]03/); assert.match(text, /2001[-/]02[-/]03/); break
      case 'market-known-breadth-no-ratio': assert.match(text, /漲方比例\s*—/); assert.match(text, /合計\s*7\s*5\s*2/); break
      case 'market-observation-legacy-timeline':
        assert.match(text, /合成舊版簡報市場讀數/)
        assert.match(text, /合成未識別市場讀數[\s\S]*市場 unknown/)
        assert.match(text, /合成盤中回執與時間軸同一讀數/)
        assert.equal(await panel.getByRole('region', { name: '正式簡報與事件讀回的市場讀數', exact: true }).count(), 1)
        assert.equal(await panel.getByRole('region', { name: '盤中市場讀數', exact: true }).count(), 1)
        assert.equal(text.split('合成盤中回執與時間軸同一讀數').length - 1, 1, 'the exact same observation is rendered once across receipt and timeline projections')
        assert.doesNotMatch(text, /合成摘要也隨精確同一觀察重複/)
        break
      case 'market-observation-event-projection':
        assert.match(text, /正式簡報與事件讀回的市場讀數/)
        assert.match(text, /合成目前簡報市場讀數/)
        const earlierBrief = panel.locator('li').filter({ hasText: '合成較早版次' }).getByRole('button')
        assert.match(await earlierBrief.innerText(), /1 則市場讀數/)
        await earlierBrief.click()
        assert.match(await panel.innerText(), /更早版次專屬市場讀數/)
        break
      case 'session-tw': assert.match(text, /台股盤前注意/); assert.match(text, /08:00/); break
      case 'session-stale-us': assert.match(text, /目前最新可用簡報，不代表今天新產生的決定/); assert.match(text, /跨日後仍保留最新簡報中的行動/); assert.match(text, /2026-09-29/); assert.match(text, /21:20/); assert.equal(await panel.getByLabel('主要下一步').count(), 1); break
      case 'session-missing': assert.match(text, /版次未標示/); break
      case 'session-malformed-times': assert.doesNotMatch(text, /99:99/); break
      case 'watch-read-error': assert.match(text, /讀取失敗|讀不到/); assert.doesNotMatch(text, /目前沒有待處理工作/); break
      case 'watch-eligibility':
        assert.match(text, /Synthetic due-today|Synthetic promoted/)
        assert.match(text, /已完成提醒/)
        assert.equal(await page.locator('#investment-panel-today').getByLabel('今日個人提醒').count(), 0)
        break
      case 'tw-rs-unavailable': assert.match(text, /來源不可用/); assert.doesNotMatch(await page.locator('[data-tw-rs-symbol="DEMO-TW-A.TW"]').innerText(), /\+3.25%/); break
      case 'tw-rs-read-error': assert.match(text, /讀取失敗，來源狀態未知/); break
      case 'structured-judgment':
        assert.equal(await page.locator('#investment-panel-today [role="group"][aria-label="主要下一步"]').count(), 1)
        assert.match(todaySteps, /合成判斷：先等正式結果/)
        assert.match(todaySteps, /接下來看什麼[\s\S]*2026-10-05/)
        assert.match(todaySteps, /什麼結果會改變判斷[\s\S]*需求確認才重新評估/)
        assert.match(todaySteps, /wiki\/morning\/synthetic-brief\.md/)
        assert.match(todaySteps, /sha256:synthetic-judgment-r1/)
        assert.match(todaySteps, /demo-storage-event/)
        assert.match(todaySteps, /判斷資料截至/)
        assert.doesNotMatch(todaySteps, /why_now: 尚缺公開需求證據/)
        break
      case 'structured-judgment-generic-action':
        assert.match(todaySteps, /什麼結果會改變判斷[\s\S]*需求確認才重新評估/)
        assert.match(todaySteps, /行動：合成判斷：先等正式結果； why_now:/)
        break
      case 'structured-judgment-multiple-primary':
        assert.match(todaySteps, /什麼結果會改變判斷[\s\S]*需求確認才重新評估/)
        assert.match(todaySteps, /合成判斷：先等正式結果； why_now:/)
        assert.match(todaySteps, /第二筆正式行動，需保留。/)
        break
      case 'structured-judgment-invalid-watch':
      case 'structured-judgment-invalid-provenance':
        assert.doesNotMatch(todaySteps, /什麼結果會改變判斷/)
        assert.match(todaySteps, /合成判斷：先等正式結果； why_now:/)
        break
      case 'quote-cached-error': assert.match(text, /更新失敗，顯示上次數值/); break
      case 'pulse-cached-error': assert.match(text, /台股市場脈搏更新失敗/); break
      case 'market-empty-refetch':
      case 'market-omitted-refetch': assert.match(text, /先前快照[\s\S]*島嶼設備甲/); assert.match(text, /2001[-/]02[-/]03/); break
      case 'legacy-evidence': assert.match(text, /合成舊版方向未明原文/); assert.match(text, /合成同層全域列/); assert.match(text, /合成全域列仍未連結/); assert.match(text, /合成舊版公開記錄/); assert.match(text, /合成舊版反方/); assert.match(text, /合成舊版未知/); assert.match(text, /synthetic-legacy-row.md/); break
      case 'layer-reading': assert.match(text, /合成分層解讀：出貨增加但終端需求待確認/); assert.match(text, /AI/); break
      default: assert.fail(`Missing scenario oracle: ${scenario}`)
    }
    const measured = await layout(page, scenario)
    assert.deepEqual(errors, [], `${scenario}: no runtime errors`)
    assert.deepEqual(externalRequests, [], `${scenario}: no external requests`)
    await page.screenshot({ path: `${output}/${scenario}.png`, fullPage: true })
    report.scenarios.push({ name: scenario, ...measured, errors, externalRequests })
    await page.close()
  }
  // Synthetic personal writes remain available inside Research and never project onto Today.
  const { page } = await openPage(390)
  await page.getByRole('tab', { name: '研究與策略', exact: true }).click()
  const reminders = page.getByRole('region', { name: '我的提醒', exact: true })
  await reminders.getByLabel('個人提醒內容', { exact: true }).fill('合成瀏覽器提醒')
  await reminders.getByRole('button', { name: '新增提醒', exact: true }).click()
  await reminders.getByText('合成瀏覽器提醒', { exact: true }).waitFor()
  await reminders.getByRole('button', { name: '加入今日', exact: true }).click()
  await reminders.getByText(/已加入今日/).waitFor()
  await page.getByRole('tab', { name: 'Today', exact: true }).click()
  assert.equal(await page.locator('#investment-panel-today').getByText('合成瀏覽器提醒', { exact: true }).count(), 0)
  await page.close()
  console.log(JSON.stringify({ pages: report.pages.length, scenarios: report.scenarios.length, result: 'passed' }))
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
