# PersonalOS：產品脈絡與工作入口

整理日期：2026-09-20。這份文件保存已確認的方向與交付基線；**目前進度以對應 GitHub issue 為準**，不能只看這份快照判定完成。給雲端 agent 的接手順序：讀本文件 → 讀相關 issue → 檢查現有程式 → 認領範圍 → 開分支／PR。

## 這是什麼，為誰做

PersonalOS 是不同領域共用的視覺化與互動入口，讓使用者查看各領域系統已產生的狀態並繼續工作。每個 Domain 各自擁有真相、推理、判斷、流程、結果與學習；PersonalOS 投影既有輸出，不接管或重做 Domain 推理。目前不要求沉澱成通用商業產品，也不以取代 Jira／Linear 或做全功能連接工具為方向。

最早關注 AI 時間與 token 消耗，後來加入運動、投資、任務與目標。AI 用量與運動仍有價值，但使用者已有其他查看管道，未必每天要來這裡。Investment Note 是完整且唯一的投資系統；Investment 是 PersonalOS 的第一個參考整合，不代表 PersonalOS 以投資為中心，也不要求其他 Domain 採用投資資料模型。跨 Domain 的優先排序與推理延後到多個成熟 Domain 形成明確需求時再討論。

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
| [#9](../../issues/9) | Domain-owned state → provider → PersonalOS projection 的單一整合模式索引 | Investment 為目前 reference；私人 identity、部署與 owner acceptance 分別追蹤 |

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

## 領域正本與共用 Provider 邊界（2026-09-29 owner decision）

`personal-os-visualization` 是 PersonalOS 共用 UI、information architecture、精簡 module
contract、provider selection/wiring、degraded-state semantics 與 synthetic/reference
implementations 的 canonical product source。PersonalOS 是使用者跨獨立 Domain 的共同
視覺化與互動入口；Domain provider 只把已由該 Domain 產生的狀態與結果提供給投影。
Provider contract 不規定、不複製 Domain 如何推理。

共用 module binding 僅描述 module identity、宣告的 surfaces/capabilities、明確選中的
provider，以及 `ready`／`partial`／`unavailable` 和可選 freshness、provenance、detail/source
references。Domain payload、read model、推理語意與工作流程都留在各自 Domain。不可新增
universal state envelope、第二 canonical store、knowledge graph 或通用 invocation／orchestration
framework；缺少能力時不得依其他欄位推測或 fallback 到別的 provider。

Investment Note 是完整且唯一的 Investment domain system。Investment 是第一個 reference
module，不是 PersonalOS 的架構中心。Today、Judgment、Research、History 與現有 optional
market/watch surfaces 是 Investment Note 已產生內容的唯讀投影；「Judgment」表示 Investment
Note 的 judgment/read model，不是 PersonalOS 自己的判斷。PersonalOS 不計算 thesis strength，
不分類 trade/watch/ignore，不推測 event semantics，不做 valuation/base-rate/expectation
reasoning，不選 L2/L3/L4 深度，也不從 ticker/title/prose 推論關係。Investment Note 自己產生的
conflict、drift、source/cutoff/provenance 與 partial/unavailable 狀態必須照原意保留並 fail closed。
Producer 已產生的 #61 `current_reading`／`gaps` 可以照來源內容呈現；PersonalOS 不重寫、不重算。

跨 Domain 的排序或推理明確延後到多個成熟 Domain 形成具體產品需求時再討論。#9 是
`Domain-owned state → Domain provider → PersonalOS projection` 這一種整合模式的驗證／索引；
#39 維護共用架構，#34 維護 Investment UX acceptance，#38 維護私人整合身份與正常入口驗收。

Private PersonalOS 可為各自的 Domain 提供 adapter、runtime、credentials 與 private context，
但不複製 Domain truth，也不長期 fork shared UI/contracts。合成案例必須完全虛構，不是匿名化
私人紀錄；shared repo 不得加入 private path/content、credentials、真實資料或 producer schema。
沒有 explicit relation 時，不跨 Domain 自動連結內容。

| 層 | `personal-os-visualization` | Domain provider / private integration |
|---|---|---|
| Shared product | 共用 UI、information architecture、minimal module binding 與 projection rules | 不另行 fork shared UI |
| Provider selection | 每個 module 明確選擇 provider；未設定即 fail closed | 提供 Domain 自己已產生的讀取模型 |
| Capability state | 呈現 `ready`／`partial`／`unavailable` 及 optional provenance/freshness | 如實暴露來源 state、cutoff 與限制，不重新推理 |
| Reference operation | 合成 provider 使用 browser memory、無 network/private fallback | 真實來源、adapter、runtime 與 credentials 留在其 Domain/私人端 |
| Acceptance | shared contract、synthetic/degraded/browser checks | producer、API、served bundle、private browser 與 owner acceptance 分開驗證 |

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

本文件是 shared repo 的產品與協作脈絡。雲端修改使用分支與 PR，並執行 `npm test`、`npm run lint`、`npm run build`。README 與 AGENTS 由私人維護者的文件 exporter 產生；需要更新時改 authoring source，再以正常 export 流程更新產物，不直接手改生成文件或 receipt 雜湊。

Private 維護者以既有三向流程檢查 shared changes；conflict、新檔與刪除先逐項審查，不以改 receipt hash 清除衝突。匯入後重建並讀回 private runtime，再把驗證結論更新到 issue。Cloud agents 不得宣稱已執行 private integration checks。

Shared PR/CI、private API/provider、served bundle、browser readback 與展示網站部署是分開的證據。前一項成功不保證後一項。#7 負責展示網站差距；目標 client 的 GitHub access 也要獨立驗證。
