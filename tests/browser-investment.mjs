import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

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
await page.addInitScript(scenario => {
  window.__investmentReadHook = async data => {
    if (Array.isArray(data?.rows) && typeof data?.coverage?.candidate_count === 'number') {
      data.rows = [...data.rows, ...['DEMO-TW-A.TW', 'DEMO-TW-B.TWO', 'DEMO-TW-C.TW'].map(symbol => ({ ...data.rows[0], symbol, holding: true }))]
    }
    if (data?.brief && scenario === 'structured-judgment') {
      data.brief.judgment = { class: 'watch', judgment: '合成判斷：先等正式結果', why_now: '尚缺公開需求證據', revisit: '2026-10-05', decision_effect: '需求確認才重新評估', provenance: { validated_story_ids: ['demo-storage-event'], source_cutoff: data.brief.source_cutoff } }
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
        data.brief.source = null
        data.brief.envelope = { ...data.brief.envelope, completeness: 'partial', limitations: [] }
        data.today = { state: 'ready', decision_summary: null, updates: [], limitations: [] }
      }
      if (scenario === 'research-only') {
        data.brief.state = 'current'
        data.brief.actions = []
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
}, scenario)
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
        const order = ['目前判斷', '支持訊號', '挑戰訊號', '最近一次明確記錄的判斷與驗證', '下一驗證點', '五層詳細證據']
        const bounds = await Promise.all(order.map(name => panel.getByRole('heading', { name, exact: true }).boundingBox()))
        assert.ok(bounds.every((box, i) => box && (i === 0 || box.y > bounds[i - 1].y)), 'judgment and explicit signals precede evidence')
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
  // Preserve legacy degraded-state scenarios, now checked against the converged owner layout.
  const scenarios = ['unlinked-long', 'blank-summary', 'missing', 'actions-partial', 'research-only', 'initial-error', 'refresh-error', 'quote-unavailable', 'narrative-stale-partial', 'narrative-delayed', 'market-empty', 'market-unavailable', 'market-cached-unavailable', 'market-initial-error', 'market-refresh-error', 'market-refresh-delayed', 'market-refresh-unavailable', 'market-mixed-dates', 'market-known-breadth-no-ratio', 'session-tw', 'session-stale-us', 'session-missing', 'session-malformed-times', 'watch-read-error', 'watch-eligibility', 'tw-rs-unavailable', 'tw-rs-read-error', 'structured-judgment', 'layer-reading', 'quote-cached-error', 'pulse-cached-error', 'market-empty-refetch', 'market-omitted-refetch', 'legacy-evidence']
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
    if (scenario.startsWith('narrative-') || scenario === 'layer-reading' || scenario === 'legacy-evidence') {
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
    await expand(panel)
    const text = await panel.innerText()
    switch (scenario) {
      case 'unlinked-long':
        assert.match(text, /合成未關聯判斷|缺少新證據/)
        assert.match(text, /合成越界判斷|應保留內容/)
        assert.match(text, /合成缺少關聯的風險/)
        assert.match(text, /較早的簡報|不把舊判斷/)
        break
      case 'blank-summary': assert.match(text, /最新摘要未提供[\s\S]*更正為 2%/); break
      case 'missing': assert.match(text, /尚未取得可讀的今日變化/); assert.match(text, /資料缺失不代表今天不用動/); break
      case 'actions-partial': assert.match(text, /沒有可確認的下一步/); assert.doesNotMatch(text, /今天不用動。/); break
      case 'research-only': assert.match(text, /補研究：核對合成公開資料/); break
      case 'initial-error': assert.match(text, /簡報讀取失敗/); assert.equal(await panel.getByLabel('主要下一步').count(), 0); assert.match(text, /2026-10-05/); break
      case 'refresh-error': assert.equal(await panel.getByLabel('主要下一步').count(), 0); assert.match(text, /下一步尚未確認/); assert.match(await page.locator('main').innerText(), /讀取失敗|更新失敗|本次更新失敗/); assert.match(text, /隔夜價格反應/); break
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
      case 'session-tw': assert.match(text, /台股盤前注意/); assert.match(text, /08:00/); break
      case 'session-stale-us': assert.match(text, /不把舊判斷當成今天的新決定/); break
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
      case 'structured-judgment': assert.match(text, /合成判斷：先等正式結果/); assert.match(text, /何時回看[\s\S]*2026-10-05/); break
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
