import assert from 'node:assert/strict'

// Use an admitted, external Playwright runtime; the showcase adds no dependency.
const { chromium } = await import(process.env.PLAYWRIGHT_RUNTIME || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE })
const results = []
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${process.env.UI_URL || 'http://127.0.0.1:5197'}/?tab=investment`)
    await page.getByTestId('primary-next-step').waitFor()
    assert.equal(await page.getByTestId('primary-next-step').filter({ visible: true }).count(), 1)
    assert.ok(await page.getByTestId('secondary-next-step').filter({ visible: true }).count() <= 2)
    const next = page.getByTestId('primary-next-step')
    assert.match(await next.innerText(), /為什麼現在：來源未提供/)
    assert.match(await next.innerText(), /何時再看：來源未提供/)
    const top = await next.boundingBox()
    const story = await page.getByRole('heading', { name: '今天發生了什麼' }).boundingBox()
    assert.ok(top.y < story.y, 'next step precedes story')
    const projection = page.getByLabel('來源投影的未來 30 天催化劑').filter({ visible: true })
    await projection.waitFor()
    assert.match(await projection.innerText(), /2026-10-05/)
    assert.match(await projection.innerText(), /部分涵蓋/)
    assert.match(await projection.innerText(), /日期或範圍關係未確定/)
    assert.match(await projection.innerText(), /來源涵蓋缺口/)
    assert.match(await projection.innerText(), /範圍關係：未知（未確認是否在範圍內）/)
    assert.match(await projection.innerText(), /範圍關係：可能在範圍內/)
    await page.getByLabel('各市場資料日期').waitFor()
    assert.match(await page.getByLabel('各市場資料日期').innerText(), /台股日結資料日/)
    assert.match(await page.getByLabel('各市場資料日期').innerText(), /美股各指標資料日期/)
    const taiwanRs = page.getByLabel('台股持倉相對大盤強弱', { exact: true })
    await taiwanRs.waitFor()
    assert.match(await taiwanRs.innerText(), /完整交易日 2026-09-19 · 要求日期 2026-09-20/)
    const listed = taiwanRs.locator('[data-tw-rs-symbol="DEMO-TW-A"]')
    assert.match(await listed.innerText(), /相對大盤：\+3.25 個百分點/)
    assert.match(await listed.innerText(), /同業比較：未提供/)
    assert.match(await listed.innerText(), /觀察點 61\/61/)
    const otc = taiwanRs.locator('[data-tw-rs-symbol="DEMO-TW-B"]')
    assert.match(await otc.innerText(), /TPEx · 不可用/)
    assert.match(await otc.innerText(), /相對大盤：未取得/)
    assert.match(await taiwanRs.locator('[data-tw-rs-symbol="DEMO-TW-C"]').innerText(), /交易所未確認/)
    assert.match(await projection.innerText(), /與今日行動／論點的關係：未連結/)
    for (const label of ['今日', '我的判斷', '研究與策略', '復盤與學習']) {
      await page.getByRole('tab', { name: label, exact: true }).click()
      const panel = page.getByRole('tabpanel').filter({ visible: true }).first()
      if (label === '我的判斷') {
        await page.getByRole('heading', { name: '當下判斷', exact: true }).waitFor()
        assert.match(await panel.innerText(), /反方涵蓋未知／來源未提供/)
        const recorded = await page.getByRole('heading', { name: '最近一次明確記錄的判斷與驗證' }).boundingBox()
        const detail = await page.getByText('詳細論點文字', { exact: true }).boundingBox()
        assert.ok(recorded.y < detail.y, 'recorded judgment precedes detail')
        const current = await page.getByRole('heading', { name: '當下判斷', exact: true }).boundingBox()
        const support = await page.getByText('來源列出的支持訊號', { exact: true }).boundingBox()
        const challenge = await page.getByText('來源列出的挑戰訊號', { exact: true }).boundingBox()
        const checkpoint = await page.getByRole('heading', { name: '下一個驗證點', exact: true }).boundingBox()
        const layers = await page.getByRole('heading', { name: '五層證據', exact: true }).boundingBox()
        assert.ok(current.y < support.y && support.y < challenge.y && challenge.y < recorded.y && recorded.y < checkpoint.y && checkpoint.y < layers.y && layers.y < detail.y, 'judgment signals and recorded checkpoints precede detailed layer evidence')
        assert.match(await panel.innerText(), /下一個驗證點/)
      }
      if (label === '研究與策略') {
        const catalystModule = panel.getByLabel('來源投影的未來 30 天催化劑')
        await catalystModule.getByRole('heading', { name: '未來 30 天催化劑' }).waitFor()
        const researchLibrary = panel.getByRole('region', { name: '正式 Research' })
        await researchLibrary.waitFor()
        assert.equal(await researchLibrary.locator('[data-testid="research-direction"]').count(), 5, 'five source-defined research directions remain visible')
        const otherCoverage = researchLibrary.getByTestId('research-other')
        assert.match(await otherCoverage.locator('summary').innerText(), /未列入明示方向（Other coverage） · 2 \/ 7 項/)
        assert.equal(await otherCoverage.getAttribute('open'), null, 'unlinked coverage stays available without reading as a sixth direction')
        await otherCoverage.locator('summary').click()
        assert.match(await otherCoverage.innerText(), /未連結 1 項；其餘 1 項的方向未知/)
        await otherCoverage.locator('summary').click()
        const catalystTop = await catalystModule.boundingBox()
        const researchTop = await researchLibrary.boundingBox()
        assert.ok(catalystTop.y < researchTop.y, '30-day catalysts are independently discoverable before Research')
        const sourceActions = panel.getByTestId('investment-source-actions')
        assert.match(await sourceActions.innerText(), /來源 status：尚未結案 · 1 項/)
        assert.match(await sourceActions.innerText(), /來源 status：已有判斷頁可承接 · 1 項/)
        assert.match(await sourceActions.innerText(), /不推定緊急程度/)
        assert.equal(await panel.getByTestId('investment-personal-notes').getAttribute('open'), null)
        assert.equal(await panel.getByTestId('investment-system-status').getAttribute('open'), null)
        assert.match(await panel.innerText(), /尚未提供/)
        assert.match(await panel.innerText(), /目前研究方向/)
      }
      if (label === '復盤與學習') {
        await page.getByRole('heading', { name: '當時判斷 → 後續結果 → 已記錄心得' }).waitFor()
        assert.match(await panel.innerText(), /來源未提供今年反覆模式/)
        assert.match(await panel.innerText(), /公司研究檢查點/)
      }
      const collapsed = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
      assert.ok(collapsed.scroll <= collapsed.client, `${width}px ${label} collapsed overflow: ${JSON.stringify(collapsed)}`)
      // Expand source details too: long identifiers must wrap rather than widening the page.
      await panel.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = true }))
      await page.waitForTimeout(100)
      const expanded = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
      assert.ok(expanded.scroll <= expanded.client, `${width}px ${label} expanded overflow: ${JSON.stringify(expanded)}`)
      results.push({ width, tab: label, collapsed, expanded })
    }
    assert.deepEqual(errors, [])
    await page.close()

    // Fault only the synthetic brief response. Narrative projection remains available.
    const briefFailurePage = await browser.newPage({ viewport: { width, height: 1000 } })
    const failureErrors = []
    briefFailurePage.on('pageerror', error => failureErrors.push(error.message))
    await briefFailurePage.addInitScript(() => {
      window.__investmentReadHook = data => {
        if (data?.brief) throw new Error('Synthetic brief failure')
        return data
      }
    })
    await briefFailurePage.goto(`${process.env.UI_URL || 'http://127.0.0.1:5197'}/?tab=investment`)
    await briefFailurePage.getByRole('alert').filter({ hasText: '簡報讀取失敗' }).waitFor()
    assert.equal(await briefFailurePage.getByTestId('primary-next-step').count(), 0, 'no cached brief exists')
    const independentProjection = briefFailurePage.getByLabel('來源投影的未來 30 天催化劑').filter({ visible: true })
    await independentProjection.waitFor()
    assert.match(await independentProjection.innerText(), /2026-10-05/)
    assert.match(await independentProjection.innerText(), /部分涵蓋/)
    assert.doesNotMatch(await independentProjection.innerText(), /催化劑來源本次讀取失敗/)
    const failureCollapsed = await briefFailurePage.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    await independentProjection.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = true }))
    const failureExpanded = await briefFailurePage.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    assert.ok(failureCollapsed.scroll <= failureCollapsed.client)
    assert.ok(failureExpanded.scroll <= failureExpanded.client)
    assert.deepEqual(failureErrors, [])
    results.push({ width, scenario: 'brief-failed-narrative-ready', collapsed: failureCollapsed, expanded: failureExpanded })
    await briefFailurePage.close()
  }
  for (const state of ['unavailable', 'read-error']) {
    const page = await browser.newPage({ viewport: { width: 320, height: 1000 } })
    await page.addInitScript(state => {
      window.__investmentReadHook = data => {
        if (data?.artifact === 'tw-holdings-relative-strength') {
          if (state === 'read-error') throw new Error('Synthetic RS read error')
          data.state = 'unavailable'
          data.holdings = []
          data.as_of = 'unknown'
        }
        return data
      }
    }, state)
    await page.goto(`${process.env.UI_URL || 'http://127.0.0.1:5197'}/?tab=investment`)
    const rs = page.getByLabel('台股持倉相對大盤強弱', { exact: true })
    if (state === 'read-error') await rs.getByRole('alert').waitFor()
    else await rs.getByText('來源標示相對強弱不可用；不是零，也不代表沒有台股持倉。', { exact: true }).waitFor()
    const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    assert.ok(layout.scroll <= layout.client)
    results.push({ width: 320, scenario: `tw-rs-${state}`, layout })
    await page.close()
  }
  console.log(JSON.stringify(results, null, 2))
} finally { await browser.close() }
