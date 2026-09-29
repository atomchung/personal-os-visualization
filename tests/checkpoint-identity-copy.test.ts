import assert from "node:assert/strict"
import test from "node:test"
import { foldBReason, isEventIdentityLimitation, translateLegacyLimitation } from "../src/lib/investmentToday.ts"

test("both producer wordings of the missing event identity read as plain Chinese", () => {
  for (const raw of ["legacy 登記缺明示事件 identity；未自動合併", "pool 登記缺明示事件 identity"]) {
    assert.equal(isEventIdentityLimitation(raw), true)
    assert.equal(translateLegacyLimitation(raw), "沒有對應的事件身份")
  }
  assert.equal(foldBReason(["pool 登記缺明示事件 identity"]), "沒有對應的事件身份")
})

test("other producer limitations keep their own wording", () => {
  assert.equal(isEventIdentityLimitation("next_catalyst 已過期"), false)
  assert.equal(translateLegacyLimitation("next_catalyst 已過期"), "next_catalyst 已過期")
  assert.equal(foldBReason([]), "沒有對應的事件身份")
})
