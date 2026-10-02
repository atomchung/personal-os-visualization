# Issue 77 synthetic Today readback

These are server-rendered text readbacks of the complete `TodayBrief` section using only `tests/fixtures/today-presentation.ts`. The before snapshot uses base commit `ec2854933ee416a5e3a54df0c4b5c09d6fd9dfa6`; the after snapshot uses the implementation in this branch. The fixture has no real holdings, tickers, or financial values.

## Before

```text
今天怎麼做
正式簡報判斷 · 更新 08:01
資料截至 2001/02/03 08:00 台北
觀察
合成正式判斷原文：目前維持觀察。
這次新資訊與判斷
合成正式簡報依據原文。
接下來看什麼
合成來源更新後重新檢視。
什麼結果會改變判斷
合成條件成立後才重新評估。
盤中提醒
狀態未提供
合成盤中提醒原文。
行動原因
合成盤中更新原因原文。
檢查點與來源
下一個明確檢查點未知；來源沒有提供可確認的日期、事件或 checkpoint。
這項工作的來源
合成盤中提醒原文。
記錄日期：2001/02/03 09:15 台北
來源：synthetic-update.json
ID：synthetic-update-1
判斷依據
簡報版次：版次未標示
判斷資料截至：2001/02/03 08:00 台北
來源文件：synthetic-brief.md
今天發生了什麼
2001-02-03 · 版次未標示 · 資料截至 08:00
這一天
2 個時點，由新到舊
09:15
盤中更新
市場日期待核對
最新
收合
資訊截至 2001/02/03 09:10 台北
版本與來源時間
市場日期待核對 · 完成 09:15 台北 · 來源核對完成
合成盤中補充觀察摘要。
對持倉 ·
合成盤中更新原因原文。
這筆更新的原始提醒
當下 ·
合成盤中提醒原文。
08:01
定版簡報
展開
資訊截至 2001/02/03 08:00 台北
版本與來源時間
實際產出 08:01 台北
合成正式簡報基線。
```

## After

This snapshot was freshly server-rendered from the final implementation at `c6ba91f059956abbf913377ded686d4afdcb0ae1` using only `tests/fixtures/today-presentation.ts`.

```text
今天怎麼做
正式簡報判斷 · 更新 08:01
資料截至 2001/02/03 08:00 台北
觀察
合成正式判斷原文：目前維持觀察。
這次新資訊與判斷
合成正式簡報依據原文。
接下來看什麼
合成來源更新後重新檢視。
什麼結果會改變判斷
合成條件成立後才重新評估。
盤中補充觀察
盤中補充觀察
狀態未提供
合成盤中提醒原文。
行動原因
合成盤中更新原因原文。
盤中補充觀察 · 更新時間 2001/02/03 09:15 台北 · 來源表示正式判斷不變
檢查點與來源
下一個明確檢查點未知；來源沒有提供可確認的日期、事件或 checkpoint。
這項工作的來源
記錄日期：2001/02/03 09:15 台北
來源：synthetic-update.json
ID：synthetic-update-1
story_id：synthetic-story-1
判斷依據
簡報版次：版次未標示
判斷資料截至：2001/02/03 08:00 台北
來源明示關聯 action ID：synthetic-formal-action-1
來源文件：synthetic-brief.md
今天發生了什麼
2001-02-03 · 版次未標示 · 資料截至 08:00
這一天
2 個時點，由新到舊
09:15
盤中補充觀察 · 快速掃描
市場日期待核對
最新
收合
資訊截至 2001/02/03 09:10 台北
版本與來源時間
市場日期待核對 · 完成 09:15 台北 · 來源核對完成 · 更新 ID synthetic-update-1 · story_id synthetic-story-1 · 來源 synthetic-update.json · 來源標記：正式判斷不變
合成盤中補充觀察摘要。
同一筆更新的原因已在上方行動列出。
這筆更新的原始提醒
當下 ·
合成盤中提醒原文。
08:01
正式簡報 · 版次未標示
展開
資訊截至 2001/02/03 08:00 台北
版本與來源時間
實際產出 08:01 台北
合成正式簡報基線。
```

## Reproduction and evidence limits

Rendered using Node's SSR runner and Vite middleware mode: `node --experimental-strip-types --input-type=module` with `createServer({ server: { middlewareMode: true }, appType: "custom" })`, `ssrLoadModule("/src/components/investment/InvestmentPage.tsx")`, `renderToStaticMarkup`, and `syntheticPresentationBrief()` / `syntheticPresentationToday()` from `tests/fixtures/today-presentation.ts`. The rendered HTML was reduced to text content for this readback (including closed disclosure contents; not a visible-only browser capture). Command completed successfully; Vite printed a WebSocket `listen EPERM` warning in this sandbox, but server-side rendering completed and produced the text above.

The fixture is entirely synthetic and uses no real holdings, tickers, financial values, provider calls, or private records. This confirms only the component's local SSR presentation for the supplied fixture, including the explicitly declared `declared_decision_transition: false` and `same_action_id`; it does not verify the private provider, live API, served bundle, interactive browser behavior, or owner acceptance. The source identifiers and relation wording shown here come from fixture fields and do not establish additional producer semantics.
