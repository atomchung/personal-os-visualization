import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "@/App"
import "@/index.css"
import { bindInvestmentProvider } from "@/lib/investment"
import { selectModuleProvider } from "@/lib/moduleProvider"
import { demoInvestmentProvider } from "@/demo/investmentProvider"

selectModuleProvider(bindInvestmentProvider(demoInvestmentProvider))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
