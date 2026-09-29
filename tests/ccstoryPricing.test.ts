import assert from "node:assert/strict"
import test from "node:test"

import { formatUnpricedModelCostNote } from "../src/lib/ccstoryPricing.ts"

test("explains that the subtotal includes priced portions of partially priced models", () => {
  assert.equal(
    formatUnpricedModelCostNote(["grok-4.6-build", "codex-auto-review"]),
    "費率未完整的模型：grok-4.6-build、codex-auto-review；成本只計入已知費率部分，未知部分未計入。",
  )
})

test("does not show a pricing note when every model is priced", () => {
  assert.equal(formatUnpricedModelCostNote([]), null)
})
