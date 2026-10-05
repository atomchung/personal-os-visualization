import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { syntheticJudgmentUpdate } from './fixtures/today-presentation.ts'

// Frozen producer examples; all questions, answers, identities and sources are fictional.
const producerRevision = '1d394c9419654b92d1e9298383ace92e0dc5909a'
const fixture = JSON.parse(await readFile(new URL('../src/demo/checkpoint-review-examples.json', import.meta.url), 'utf8'))
assert.equal(fixture.contract, 'today.checkpoint_reviews/v1')
assert.equal(fixture.evidence_class, 'synthetic_only')
const { examples } = fixture
const { chromium } = await import(process.env.PLAYWRIGHT_RUNTIME || 'playwright')
const origin = new URL(process.env.UI_URL || 'http://127.0.0.1:4173').origin
const output = process.env.BROWSER_OUTPUT || '.artifacts/checkpoint-reviews'
await mkdir(output, { recursive: true })
for (let attempt = 0; attempt < 40; attempt++) {
  try { if ((await fetch(origin)).ok) break } catch {}
  if (attempt === 39) throw new Error('Preview did not start')
  await new Promise(resolve => setTimeout(resolve, 250))
}

// Fail if the execution environment cannot support Chromium's sandbox.
// Do not disable the sandbox to make a restricted cloud environment pass.
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE,
})
const report = {
  revision: process.env.GITHUB_SHA || 'local-preview',
  sourceRevision: process.env.SOURCE_REVISION || 'local-preview',
  producerRevision,
  browser: browser.version(),
  mode: 'synthetic-only',
  result: 'running',
  scenarios: [],
}

async function openPage(width, scenario, projection) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  page.setDefaultTimeout(7000)
  const errors = [], externalRequests = [], dataRequests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.origin !== origin) externalRequests.push(request.url())
    if (['fetch', 'xhr'].includes(request.resourceType())) dataRequests.push(request.url())
  })
  await page.addInitScript(({ scenario, projection, preserved }) => {
    window.__checkpointBrowserReads = 0
    window.__investmentReadHook = async data => {
      window.__checkpointBrowserReads += 1
      if (data?.brief && data?.today) {
        if (scenario.endsWith('partial-preserved')) {
          data.brief = structuredClone(preserved.brief)
          data.today = structuredClone(preserved.today)
          data.today.state = 'partial'
          data.today.limitations = ['current_judgment_preserved: 合成每日判斷保留，不代表逐題回查失敗。']
        }
        if (scenario === 'without-judgment') {
          data.brief.state = 'missing'
          data.brief.judgment = null
          data.brief.actions = []
          data.brief.action_items = []
          data.today.current_judgment = null
          data.today.decision_summary = null
          data.today.updates = []
          for (const market of Object.values(data.today.intraday_refresh?.markets ?? {})) {
            if (market) market.current_judgment = null
          }
        }
        data.today.checkpoint_reviews = structuredClone(projection)
      }
      return data
    }
  }, { scenario, projection, preserved: syntheticJudgmentUpdate('preserved') })
  await page.goto(`${origin}/?tab=investment`, { waitUntil: 'networkidle' })
  return { page, errors, externalRequests, dataRequests }
}

async function layout(page, label) {
  const result = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }))
  assert.ok(result.scrollWidth <= result.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(result)}`)
  return result
}

function includesText(text, expected, context) {
  assert.ok(text.includes(expected), `${context}: missing source text ${JSON.stringify(expected)}`)
}

function includesTimestamp(text, timestamp, context) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]))
  const formatted = `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`
  assert.ok(text.includes(timestamp) || text.includes(formatted), `${context}: missing timestamp ${timestamp}`)
}

async function mainRow(row, item) {
  assert.equal(await row.isVisible(), true, `${item.checkpoint_id}: source row is visible`)
  const text = await row.innerText()
  for (const value of [item.question, item.display.result, item.display.status_label,
    item.display.judgment_label, item.display.action_label]) includesText(text, value, item.checkpoint_id)
  for (const effect of [item.judgment_effect, item.action_effect]) {
    if (effect.summary) includesText(text, effect.summary, item.checkpoint_id)
  }
  includesText(text, '原先的問題', item.checkpoint_id)
  includesText(text, '今天的答案', item.checkpoint_id)
  assert.equal(await row.getByRole('group', { name: '判斷與行動影響', exact: true }).count(), 1)
  assert.ok(text.indexOf(item.question) < text.indexOf(item.display.result), 'question precedes source answer')
  assert.ok(text.indexOf(item.display.result) < text.indexOf(item.display.judgment_label), 'source answer precedes judgment impact')
  const details = row.locator('summary').filter({ hasText: /^原預期、期限與來源$/ }).locator('..')
  assert.equal(await details.count(), 1, `${item.checkpoint_id}: one source disclosure`)
  assert.equal(await details.getAttribute('open'), null, `${item.checkpoint_id}: original expectation stays collapsed`)
  return details
}

async function sourceDetails(row, item) {
  const summary = row.locator('summary').filter({ hasText: /^原預期、期限與來源$/ })
  await summary.click()
  const details = summary.locator('..')
  assert.notEqual(await details.getAttribute('open'), null)
  const text = await details.innerText()
  for (const value of [item.expectation, item.baseline.judgment, item.baseline.action,
    item.baseline.reason, item.baseline.source_refs, item.origin.path, item.origin.source_revision]) {
    includesText(text, value, `${item.checkpoint_id} source detail`)
  }
  for (const effect of [item.judgment_effect, item.action_effect]) {
    if (effect.reason) includesText(text, effect.reason, `${item.checkpoint_id} effect reason`)
  }
  includesTimestamp(text, item.due_at, 'original due time')
  includesTimestamp(text, item.provenance.origin_cutoff, 'origin cutoff')
  if (item.review) {
    includesTimestamp(text, item.review.checked_at, 'review time')
    includesTimestamp(text, item.review.evidence_cutoff, 'review evidence cutoff')
    for (const evidence of item.review.evidence) {
      const links = await details.locator('a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))
      assert.ok(text.includes(evidence.source_url) || links.includes(evidence.source_url), 'source evidence URL remains accessible')
    }
  }
  if (item.provenance.review) {
    includesText(text, item.provenance.review.path, 'review path')
    includesText(text, item.provenance.review.source_revision, 'review revision')
  }
}

const cases = [
  ...[1080, 390, 320].map(width => ({ width, name: 'day2', projection: examples.day2 })),
  { width: 320, name: 'day3', projection: examples.day3 },
  { width: 320, name: 'today-partial-preserved', projection: examples.day2 },
  { width: 320, name: 'source-partial-preserved', projection: examples.revision_mismatch },
  { width: 320, name: 'without-judgment', projection: examples.day2 },
  { width: 320, name: 'untracked', projection: examples.untracked },
]

try {
  for (const { width, name, projection } of cases) {
    const label = `${name}-${width}`
    console.log(`Checking checkpoint reviews: ${label}`)
    const { page, errors, externalRequests, dataRequests } = await openPage(width, name, projection)
    try {
      const region = page.getByRole('region', { name: projection.display.title, exact: true })
      await region.waitFor()
      const readsBeforeExpansion = await page.evaluate(() => window.__checkpointBrowserReads)
      const rows = region.locator('article[data-checkpoint-id]')
      const row = id => region.locator(`article[data-checkpoint-id="${id}"]`)
      assert.deepEqual(await rows.evaluateAll(nodes => nodes.map(node => node.dataset.checkpointId)), projection.items.map(item => item.checkpoint_id))
      assert.equal(await region.locator('article[data-checkpoint-id]:visible').count(), Math.min(2, projection.items.length))
      assert.equal(await region.evaluate(element => element.previousElementSibling?.tagName), 'SECTION', 'checkpoint reviews are a standalone sibling after next steps')
      assert.equal(await region.evaluate(element => element.nextElementSibling?.getAttribute('aria-label')), '今天發生了什麼')
      includesText(await region.innerText(), '合成回查範例，非真實觀察或正式回查紀錄。', 'synthetic example label')
      const collapsed = await layout(page, `${label}/collapsed`)
      await page.screenshot({ path: `${output}/${label}-collapsed.png`, fullPage: true })
      for (const item of projection.items.slice(0, 2)) await mainRow(row(item.checkpoint_id), item)
      if (projection.display.coverage_label) includesText(await region.innerText(), projection.display.coverage_label, 'source coverage')
      if (!projection.items.length) includesText(await region.innerText(), projection.display.empty_message, 'untracked is not no events')

      const overflowCount = Math.max(0, projection.items.length - 2)
      if (overflowCount) {
        const summary = region.locator('summary').filter({ hasText: new RegExp(`^其他觀察 · ${overflowCount}$`) })
        assert.equal(await summary.count(), 1)
        assert.equal(await summary.locator('..').getAttribute('open'), null)
        await summary.focus()
        await page.keyboard.press('Enter')
        await row(projection.items[2].checkpoint_id).waitFor({ state: 'visible' })
        for (const item of projection.items.slice(2)) await mainRow(row(item.checkpoint_id), item)
      }
      if (projection.items.length) await sourceDetails(row(projection.items[0].checkpoint_id), projection.items[0])
      const coverage = region.locator('summary').filter({ hasText: /^回查涵蓋範圍與資料缺口$/ })
      await coverage.click()
      const coverageText = await coverage.locator('..').innerText()
      includesText(coverageText, `可讀歷史中已完成 ${projection.completed_count} 題`, 'completed count is historical coverage')
      for (const problem of projection.problems) includesText(coverageText, problem, 'source validation problem')

      if (name === 'day3') {
        assert.equal(projection.completed_count, examples.day2.completed_count)
        for (const completed of examples.day2.items.filter(item => item.state === 'completed')) {
          assert.equal(await row(completed.checkpoint_id).count(), 0, 'completed questions never reopen as pending on day 3')
        }
      }
      if (name === 'source-partial-preserved') {
        const invalid = row('synthetic-demand-supply')
        const text = await invalid.innerText()
        assert.equal(text.includes(examples.day2.items[0].display.result), false, 'invalid source cannot reuse a previously accepted answer')
        includesText(text, projection.items[0].display.judgment_label, 'invalid judgment effect remains unknown')
        includesText(text, projection.items[0].display.action_label, 'invalid action effect remains unknown')
      }
      if (name === 'without-judgment') {
        assert.equal(await page.locator('#investment-panel-today').getByRole('group', { name: '主要下一步', exact: true }).count(), 0)
      }
      const expanded = await layout(page, `${label}/expanded`)
      assert.equal(await page.evaluate(() => window.__checkpointBrowserReads), readsBeforeExpansion, 'opening source and overflow disclosures makes no extra provider reads')
      assert.deepEqual(errors, [], `${label}: no browser runtime or console errors`)
      assert.deepEqual(externalRequests, [], `${label}: no external requests`)
      assert.deepEqual(dataRequests, [], `${label}: synthetic projection makes no fetch/XHR requests`)
      await page.screenshot({ path: `${output}/${label}-expanded.png`, fullPage: true })
      report.scenarios.push({ name, width, collapsed, expanded, errors, externalRequests, dataRequests, providerReads: readsBeforeExpansion })
    } finally {
      await page.close()
    }
  }
  report.result = 'passed'
  console.log(JSON.stringify({ scenarios: report.scenarios.length, result: report.result }))
} catch (error) {
  report.result = 'failed'
  report.error = error instanceof Error ? error.message : String(error)
  throw error
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
