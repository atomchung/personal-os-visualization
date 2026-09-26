# PersonalOS：產品脈絡與工作入口

整理日期：2026-09-20。這份文件保存已確認的方向與交付基線；**目前進度以對應 GitHub issue 為準**，不能只看這份快照判定完成。給雲端 agent 的接手順序：讀本文件 → 讀相關 issue → 檢查現有程式 → 認領範圍 → 開分支／PR。

## 這是什麼，為誰做

PersonalOS 是使用者自己的注意力入口，讓分散在不同 AI 對話與資料來源的關注事項比較容易回找。目前不要求沉澱成通用商業產品，也不以取代 Jira／Linear 或做全功能連接工具為方向。

最早關注 AI 時間與 token 消耗，後來加入運動、投資、任務與目標。AI 用量與運動仍有價值，但使用者已有其他查看管道，未必每天要來這裡。近期希望先把投資做成每天願意打開的看板；暫不擴張目標管理、email／calendar 或所有資料來源整合。

投資工作包含日報、新聞與技術動能、社群研究、交易復盤、績效紀錄與資產盤點。這些是需求背景，**不是宣稱此 repo 已接入上述來源**。真正容易忘的是正在研究的問題，以及過去為什麼做某個判斷；所以不能只把日報堆得更多。

## 已確認的介面方向

- 投資頁「今日」維持預設首頁；正在研究留在既有待處理入口加強，不取代今日。
- 語言要自然，讓使用者知道現在看的是研究、待確認事項，還是回看舊判斷。
- 歷史復盤回答「當時為什麼這樣做、後來發生什麼、留下什麼心得」。優先既有決策復盤、每週回顧與教訓；日報存檔不是優先。
- 不把舊判斷回看等同交易紀錄核對；不把歷史判斷當成今天的建議。
- 只呈現來源已有的心得與結論。缺結果、讀取失敗、過期與涵蓋不足都要明示，不能編出第一人稱日記或把缺資料顯示成沒事情。

## 工作索引

以下狀態是整理當日基線。Issue 是進度正本；後續狀態不在本機另維護一份競爭版本。

| Issue | 範圍 | 整理時狀態 |
|---|---|---|
| [#1](../../issues/1) | 獨立前端、合成資料、本機往返同步 | 已交付基礎，非全部功能完成 |
| [#2](../../issues/2) | 今日／研究閱讀順序、文案與事件版面 | 今日 bridge、閱讀順序與窄畫面版面已整合；仍待 owner 評價 |
| [#3](../../issues/3) | 歷史復盤入口 | 私人 reader、API、歷史頁與合成案例已接通；來源完整度與 owner 驗收仍分開 |
| [#4](../../issues/4) | 無法理解的 Memory 事件提醒 | 本機已確認合法來源與 producer；timeline 改用來源事件名稱，遠端 issue 仍待 owner 讀回 |
| [#5](../../issues/5) | 多週期趨勢、近期強勢族群 | 尚未開工；計算與比較語意待定義 |
| [#6](../../issues/6) | 較早的投資判斷驗證看板提案 | 暫緩；先與 #3 去重，不沿用舊工具／數量聲稱 |
| [#7](../../issues/7) | 既有展示網站版本對齊 | 本機／canonical 已更新；既有網站 revision 尚待讀回確認，未擅自重部署 |
| [#9](../../issues/9) | 公開合成展示、私人 Context 與共用 UI 整合 | 核心程式與本機驗證完成；MCP 目標 client、部署 revision 與 owner 使用驗收分開追蹤 |

#2 的已完成部分包括：行動併入今日簡報 bullet、研究在提醒前、研究預設展開、局部機械用語修正、事件來源改成次要展開。沒有完成歷史新頁面、多週期／族群新功能，也沒有完整使用者驗收。

2026-09-20 續作把 #9 的修正擴成全站收斂：導航現在由 `src/lib/informationArchitecture.ts`
維護常用／推進／回看三個父層，今日仍是預設且投資仍是常用入口；各頁共用
`PageHeader`、`SectionHeading`、`SubsectionHeading`，今日只放跨頁摘要。新增「介面規範」
頁展示 IA、共用元件與視覺化／資料整合／上游來源三類問題。`ReadingText` 保留 Markdown
標題與巢狀清單層級，主要閱讀路徑改用自然文案；來源缺日期、結果或使用快照的問題仍
顯示為資料限制，沒有用文案掩蓋。完整前後對照與剩餘來源清單見
`docs/personal-os-visualization-convergence.md`。這是本機整合已完成的描述；canonical
repo／網站 revision／owner 使用驗收仍是分開證據。

前一個已驗證的程式基線為 `839b3a216d40203a1a5a32173b934af799151c56`；其 CI 與本機檢查證據見 #1。這是日期化交付證據，不是此文件永遠代表最新 HEAD 的保證。

## 雲端與本機各負責什麼

`personal-os-visualization` 是共用元件與可編輯資料契約的 canonical source。
`src/tokens.css` 由私人端 `core/styles.py` 生成；`src/demo/generated/` 由私人端
情境產生器生成。這兩類只往外匯出，不作為私人端匯入來源。
本機 `web/ui` 是 private integration checkout，不應另行長期演化一套 UI；本機只
注入 FastAPI/private adapter，展示端只注入 generator 產出的 synthetic scenario。
情境 brief 與生成過程留在 PersonalOS，只有通過 allowlist 與人工 review 的產物進入
這個 repo。

| 層 | 雲端 repo | 本機私人專案 |
|---|---|---|
| UI | `src/components/`、design tokens | 相同共用元件 |
| 契約 | `src/lib/api.ts`、`investment.ts`、`writes.ts` | 契約對應 FastAPI／read model |
| 資料 | `src/demo/fixtures.ts`、`src/demo/transport.ts`，完全虛構 | canonical 來源讀取、解析、計算與合法寫入 |
| Runtime | 固定 synthetic transport，無資料網路連線 | 本機 transport 接私人 API |
| 驗收 | mock 操作、空值／失敗、建置與瀏覽器 | 真資料接入、來源正確性、使用者實際入口讀回 |

本輪投資研究合成案例由私人端 deterministic scenario generator 生成，同一案例
驅動今日問題、研究卡、待查證據、歷史回看與時間事件；這不等於把任何真實紀錄
匿名化後公開。私人 task Context 只按 task scope 讀取需求、狀態、明確決定與來源
證據；公開 repo 不含 Context service、private adapter、brief 或原文。

投資研究／交易正本留在 `investment_note`；PersonalOS 做整理與呈現。本 repo 沒有 Python backend、本機 vault、健康 DB、帳號或憑證，也不包含私人 Git 歷史。雲端 agent 不應猜測讀不到的本機資料，應在 issue 留明確的契約需求，由本機維護者回報去除私人內容的結果。

入口元件：`InvestmentPage.tsx`、`ResearchWatch.tsx`、`InvestmentPending.tsx`、`InvestmentWork.tsx`、`StockMomentum.tsx`、`MarketIndicators.tsx`，均位於 `src/components/investment/`。

## Issue 分工與更新方式

使用者說明哪裡不好用與想達到什麼；AI 沿「來源 → API → 畫面」追查並分類。`ui` 是排版／文案／操作；`data` 是來源／解析／計算；`integration` 是契約／串接／同步／部署。同一需求可有多個標籤與分層 checklist，不需要使用者自己拆技術 issue。

1. 動手前查重並在 issue 留下認領、預計修改範圍與阻塞；不要把接手當成需求已獲重新定義。
2. PR 連回 issue，說明變更與證據。若只完成 UI，使用 `Refs #N`，不要用會自動關閉整個跨層需求的 `Fixes #N`。
3. scope、阻塞、已驗證進度有變時，同步 issue。交接至少列出 **UI／資料／本機整合／驗收** 各自的狀態、commit/PR、驗證環境與剩餘工作。
4. 全部適用驗收條件完成才結案。純 UI issue 不必強塞資料工作；跨層功能不能以 mock 完成代替本機串接完成。
5. 若產品方向、來源責任或驗收方式改變，同一 PR 更新本文件。本機需求筆記保留來源背景並連回 issue，GitHub 維持唯一進度紀錄。

這是 agent 執行工作時應遵守的流程，**目前沒有背景 issue 同步機器人**。不能把「已寫協作規則」宣稱為「自動分類／自動同步已上線」。

## 程式碼同步與完成證據

本文件在明確審查的 shared allowlist 內，可與 UI 一起往返；本機來源為 `web/ui/PROJECT_CONTEXT.md`。雲端修改使用分支與 PR，執行 `npm test`、`npm run lint`、`npm run build`。

本機維護者先更新獨立 checkout，再用私人專案內的 `scripts/sync_visualization.py` 做三向 check/import；衝突、新檔與刪除先明確審查。先匯入遠端單方修改，再 export 本機單方修改。匯入後重建本機前端、讀回實際入口，並把驗證結論更新到 issue。這些私人同步工具不在本 repo，雲端 agent 不應宣稱已執行它們。

`README.md`、`AGENTS.md` 與 runtime/config 等由本機 exporter 生成；不要直接改生成檔再被下次 export 覆蓋。需要改生成指引時，由本機維護者更新 exporter。不得手改 `export-receipt.json` 雜湊來消除衝突。

GitHub 程式更新、本機看板更新、展示網站部署、雲端 ChatGPT 能讀私有 repo，是四個分開的證據。前一項成功不保證後一項。#7 負責展示網站差距；客戶端存取權需在使用者的 GitHub 連線授予，尚未驗證。
