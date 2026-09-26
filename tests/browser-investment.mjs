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
    assert.match(await projection.innerText(), /可能在範圍內／日期未確定/)
    assert.match(await projection.innerText(), /來源涵蓋缺口/)
    await page.getByLabel('各市場資料日期').waitFor()
    assert.match(await page.getByLabel('各市場資料日期').innerText(), /台股日結資料日/)
    assert.match(await page.getByLabel('各市場資料日期').innerText(), /美股各指標資料日期/)
    for (const label of ['今日', '我的判斷', '研究與策略', '復盤與學習']) {
      await page.getByRole('tab', { name: label, exact: true }).click()
      const panel = page.getByRole('tabpanel').filter({ visible: true }).first()
      if (label === '我的判斷') {
        await page.getByRole('heading', { name: '當下判斷', exact: true }).waitFor()
        assert.match(await panel.innerText(), /反方涵蓋未知／來源未提供/)
        const recorded = await page.getByRole('heading', { name: '最近一次明確記錄的判斷與驗證' }).boundingBox()
        const detail = await page.getByText('詳細論點文字', { exact: true }).boundingBox()
        assert.ok(recorded.y < detail.y, 'recorded judgment precedes detail')
        assert.match(await panel.innerText(), /下一個驗證點/)
      }
      if (label === '研究與策略') {
        await page.getByLabel('來源投影的未來 30 天催化劑').filter({ visible: true }).getByRole('heading', { name: '接下來會改變判斷的事情' }).waitFor()
        assert.match(await panel.innerText(), /部分涵蓋/)
        assert.match(await panel.innerText(), /加深公司、事件與未解問題/)
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
  }
  console.log(JSON.stringify(results, null, 2))
} finally { await browser.close() }
