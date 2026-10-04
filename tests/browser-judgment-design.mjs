import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { judgmentDesignFixture } from './fixtures/judgment-design.ts'
const { chromium } = await import(process.env.PLAYWRIGHT_RUNTIME || 'playwright')
const origin = process.env.UI_URL || 'http://127.0.0.1:4173'
const output = process.env.BROWSER_OUTPUT || '.artifacts/judgment-design'
const stage = process.env.DESIGN_STAGE || 'after'
await mkdir(output, { recursive: true })
for (let i = 0; i < 40; i++) { try { if ((await fetch(origin)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 250)) }
const browser = await chromium.launch({ headless: true })
const report = { stage, revision: process.env.GITHUB_SHA || '', mode: 'synthetic-only', views: [], checks: [] }
async function open(width, stress = false) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  page.setDefaultTimeout(7000)
  const errors = [], external = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()) })
  const fixture = judgmentDesignFixture()
  await page.addInitScript(({ fixture, stress }) => {
    window.__investmentReadHook = async data => {
      if (data?.narratives?.[0]?.thesis_evidence) {
        const copy = structuredClone(fixture.data)
        // Preserve unrelated provider sections; replace only the judgment fixture.
        data.narratives = copy.narratives; data.state = copy.state; data.limitations = []; data.source_cutoff = copy.source_cutoff
        if (stress) {
          const layer = data.narratives[0].thesis_evidence.layers[0]
          layer.players = Array.from({ length: 100 }, (_, i) => ({ entity_id: `garden-player-${i}`, player: `花圃 ${String(i + 1).padStart(3, '0')}`, recorded_at: '2001-02-03', source: { path: 'synthetic/garden-players.md', line: i + 1 } }))
          layer.evidence = layer.players.map((player, i) => ({ ...structuredClone(layer.evidence[0]), evidence_id: `garden-evidence-${i}`, entity_id: player.entity_id, player: player.player, explanation: `長文起點${'不同環境需要保留完整的觀察條件與來源限制。'.repeat(15)}長文終點`, claim_relations: [] }))
        }
      }
      if (data?.brief && data?.today) data.brief = structuredClone(fixture.brief)
      return data
    }
  }, { fixture, stress })
  await page.goto(`${origin}/?tab=investment`, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: '我的判斷', exact: true }).click()
  await page.getByRole('article', { name: '目前判斷', exact: true }).waitFor()
  return { page, errors, external }
}
async function measure(page) {
  return page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, panel: document.querySelector('#investment-panel-thesis').getBoundingClientRect().width, overview: document.querySelector('[aria-label="目前判斷"]').getBoundingClientRect().width }))
}
try {
  for (const width of [1080, 390, 320]) {
    const { page, errors, external } = await open(width)
    const panel = page.locator('#investment-panel-thesis')
    const metrics = await measure(page)
    assert.ok(metrics.scrollWidth <= width + 1, `overflow ${JSON.stringify(metrics)}`)
    if (stage === 'after') {
      assert.equal(await panel.getByTestId('judgment-layers').getAttribute('open'), null)
      assert.equal(await panel.getByTestId('judgment-signals').getAttribute('open'), null)
      const box = await panel.locator('.judgment-overview').boundingBox()
      assert.ok(Math.abs(box.width - metrics.panel) < 2, 'overview uses the sibling page width')
      const support = await panel.locator('.judgment-relation-group[data-direction="supports"]').boundingBox()
      const challenge = await panel.locator('.judgment-relation-group[data-direction="challenges"]').boundingBox()
      if (width >= 1000) assert.equal(Math.round(support.y), Math.round(challenge.y), 'support and challenge are peers')
      assert.match(await panel.innerText(), /歷史資料，來源已過期/)
      assert.match(await panel.innerText(), /對此主張有混合影響/)
    }
    if (width !== 320) {
      await page.screenshot({ path: `${output}/${stage}-${width}-full.png`, fullPage: true })
      await panel.getByRole('article', { name: '主張與證據', exact: true }).screenshot({ path: `${output}/${stage}-${width}-evidence.png` })
    }
    if (stage === 'after') {
      const fold = panel.getByTestId('judgment-layers')
      const toggle = fold.locator(':scope > summary')
      await toggle.focus(); await page.keyboard.press('Enter')
      assert.equal(await fold.getAttribute('open'), '')
      await page.keyboard.press('Space')
      assert.equal(await fold.getAttribute('open'), null)
      await page.getByRole('tab', { name: 'Today', exact: true }).click()
      await page.getByRole('tab', { name: '我的判斷', exact: true }).click()
      assert.equal(await fold.getAttribute('open'), null, 'navigation retains deliberate disclosure state')
      await panel.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = true }))
      const expanded = await measure(page)
      assert.ok(expanded.scrollWidth <= width + 1, 'expanded content wraps')
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, [])
    report.views.push({ width, ...metrics, errors, external }); await page.close()
  }
  if (stage === 'after') for (const width of [1080, 390, 320]) {
    const { page, errors, external } = await open(width, true)
    const fold = page.getByTestId('judgment-layers')
    await fold.locator(':scope > summary').click()
    const players = fold.locator('details').filter({ has: page.locator('summary', { hasText: '玩家與公開證據 · 100 位明確連結玩家' }) }).first()
    await players.locator(':scope > summary').click()
    await players.getByRole('searchbox').fill('花圃 100')
    assert.match(await players.innerText(), /符合 1 位/)
    await players.getByText('花圃 100 · 1 筆明確連結證據', { exact: true }).click()
    assert.match(await players.innerText(), /長文起點[\s\S]*長文終點/)
    await players.getByRole('searchbox').fill('')
    const paging = players.getByRole('navigation', { name: '玩家搜尋結果分頁' })
    while (!(await paging.getByRole('button', { name: '下一頁' }).isDisabled())) await paging.getByRole('button', { name: '下一頁' }).click()
    assert.match(await players.innerText(), /花圃 100/)
    const metrics = await measure(page); assert.ok(metrics.scrollWidth <= width + 1)
    assert.deepEqual(errors, []); assert.deepEqual(external, [])
    report.checks.push({ name: '100-player-complete-search-pagination-long-text', width, ...metrics }); await page.close()
  }
} finally { await browser.close(); await writeFile(`${output}/${stage}-report.json`, JSON.stringify(report, null, 2)) }
console.log(JSON.stringify(report))
