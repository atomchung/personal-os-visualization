import test, { afterEach } from "node:test"
import assert from "node:assert/strict"
import {
  getInvestmentRefreshStatus,
  rereadInvestmentRefreshStatuses,
  setInvestmentProvider,
} from "../src/lib/investment.ts"
import { demoInvestmentProvider } from "../src/demo/investmentProvider.ts"

const baselineProvider = demoInvestmentProvider
afterEach(() => setInvestmentProvider(baselineProvider))

test("manual status reread only calls the private GET status routes", async () => {
  const calls: string[] = []
  let writes = 0
  setInvestmentProvider({
    ...demoInvestmentProvider,
    async getRefreshStatus(action) { calls.push(`GET status:${action}`); return { action, state: "failed" } as never },
    async startRefresh() { writes += 1; throw new Error("status reread must not start refresh") },
  })

  await rereadInvestmentRefreshStatuses(
    () => getInvestmentRefreshStatus("market"),
    () => getInvestmentRefreshStatus("news"),
  )

  assert.deepEqual(calls, ["GET status:market", "GET status:news"])
  assert.equal(writes, 0)
})
