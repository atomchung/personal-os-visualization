/** Generated from a private scenario brief; synthetic output only. */
export const investmentScenario = {
  "schema_version": 1,
  "scenario_id": "investment-research-loop-v1",
  "as_of": "2026-09-20",
  "source_title": "星島設備研究摘要（虛構）",
  "source_label": "合成研究",
  "symbol": "DEMO",
  "label": "星島設備（虛構）",
  "product": "新一代儲能產品",
  "problem": "市場消息很快，但消息本身不能直接回答研究者下一個要驗證什麼。",
  "trigger": "星島設備發表新一代儲能產品",
  "question": "交付能力是否足以支撐需求",
  "evidence_to_check": "交期、出貨節奏與早期產品回饋",
  "next_check": "交付說明會",
  "event_date": "2026-09-18",
  "next_check_date": "2026-09-23",
  "market_reaction": "範例價格上漲 1.2%",
  "price": {
    "value": 42,
    "change": 0.5,
    "change_percent": 1.2
  },
  "market_index": {
    "label": "範例指數",
    "value": 1234,
    "change": 10,
    "change_percent": 0.8,
    "meaning": "示範市場脈搏欄位"
  },
  "research_title": "產品與交付的差距",
  "research_excerpt": "這個案例把產品消息轉成一個可追蹤的研究問題：下一次讀取時，要找交付證據，而不是重複閱讀同一則消息。",
  "risk": "展示案例尚無交付證據",
  "action": "整理兩個待查問題，不由新聞直接形成交易。",
  "source_text": "星島設備（虛構）發布新一代儲能產品。\n\n這份合成案例要回答的不是消息是否熱門，而是：交付能力是否足以支撐需求。\n下一個檢查點是交付說明會，要找的證據是交期、出貨節奏與早期產品回饋。",
  "headline": "虛構案例：星島設備發表新一代儲能產品；接下來觀察交期、出貨節奏與早期產品回饋。",
  "event_text": "星島設備發表新一代儲能產品（虛構）",
  "interpretation": "市場先反應消息，交付能力是否足以支撐需求仍需用交期、出貨節奏與早期產品回饋驗證。",
  "thesis": "交付能力是否足以支撐需求",
  "thesis_change": "待驗證",
  "thesis_reason": "目前只有發布消息，尚未取得交期、出貨節奏與早期產品回饋。",
  "upcoming_event": "交付說明會（虛構）",
  "risk_status": "觀察",
  "source_id": "demo-investment-research-loop-v1",
  "source_path": "synthetic/investment-research-loop-v1",
  "catalogue_note": "星島設備（虛構）：交付能力是否足以支撐需求",
  "history": [
    {
      "id": "investment-research-loop-v1-prior",
      "title": "原先假設",
      "heading": "## 原先假設",
      "kind": "prior_judgment",
      "date": "2026-09-13",
      "excerpt": "先觀察產品需求是否會轉成可交付的訂單，不因單一發布消息改變判斷。",
      "result_state": "unknown",
      "result": "尚未有可核對結果；保留未知。",
      "excerpt_truncated": false,
      "detail_state": "available",
      "source": {
        "id": "demo-investment-research-loop-v1",
        "path": "synthetic/investment-research-loop-v1",
        "section": "原先假設",
        "line_start": 1,
        "line_end": 1
      },
      "detail": "先觀察產品需求是否會轉成可交付的訂單，不因單一發布消息改變判斷。"
    },
    {
      "id": "investment-research-loop-v1-evidence",
      "title": "新證據：星島設備發表新一代儲能產品",
      "heading": "## 新證據：星島設備發表新一代儲能產品",
      "kind": "evidence",
      "date": "2026-09-18",
      "excerpt": "星島設備發表新一代儲能產品，市場先反應消息；交期、出貨節奏與早期產品回饋仍未出現。",
      "result_state": "known",
      "result": "範例價格上漲 1.2%",
      "excerpt_truncated": false,
      "detail_state": "available",
      "source": {
        "id": "demo-investment-research-loop-v1",
        "path": "synthetic/investment-research-loop-v1",
        "section": "新證據",
        "line_start": 3,
        "line_end": 5
      },
      "detail": "星島設備發表新一代儲能產品，市場先反應消息；交期、出貨節奏與早期產品回饋仍未出現。"
    },
    {
      "id": "investment-research-loop-v1-outcome",
      "title": "目前判斷與下一步",
      "heading": "## 目前判斷與下一步",
      "kind": "current_judgment",
      "date": "2026-09-20",
      "excerpt": "交付能力是否足以支撐需求：待驗證。下一步是交付說明會，確認交期、出貨節奏與早期產品回饋。",
      "result_state": "unknown",
      "result": "後續結果尚未記錄；下一次讀取時再更新。",
      "excerpt_truncated": false,
      "detail_state": "available",
      "source": {
        "id": "demo-investment-research-loop-v1",
        "path": "synthetic/investment-research-loop-v1",
        "section": "目前判斷與下一步",
        "line_start": 6,
        "line_end": 8
      },
      "detail": "判斷：交付能力是否足以支撐需求；下一步：交付說明會；要找的證據：交期、出貨節奏與早期產品回饋。"
    }
  ],
  "context": {
    "task_slug": "personal-os-visualization-integration-9",
    "status": "in_progress",
    "updated_at": "2026-09-20",
    "next_action": "用交付說明會的交期、出貨節奏與早期產品回饋更新判斷",
    "approved": [
      "保留今日首頁，從正在研究的問題接到證據、判斷與下一步。",
      "公開展示只使用審閱過的合成案例；私人入口才讀取授權來源。"
    ],
    "rejected": [
      "不把展示數字當成真實行情。",
      "不順手擴張新的投資分析功能或全領域 Context 平台。"
    ],
    "evidence": [
      {
        "path": "synthetic/investment-research-loop-v1",
        "section": "新證據",
        "line_start": 3,
        "line_end": 5,
        "text": "星島設備發表新一代儲能產品，市場先反應消息；交期、出貨節奏與早期產品回饋仍未出現。"
      }
    ]
  }
} as const
