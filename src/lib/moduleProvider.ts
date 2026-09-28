/** Shared selection metadata only; Domain payloads and read methods stay Domain-owned. */
export type ModuleCapabilityState = "ready" | "partial" | "unavailable"
export type ModuleFreshnessState = "current" | "stale" | "unknown"

export type ModuleCapabilityDescriptor = {
  status: ModuleCapabilityState
  freshness?: {
    state: ModuleFreshnessState
    asOf?: string | null
    sourceCutoff?: string | null
  }
  provenance?: {
    producer?: string
    sourceRefs?: readonly string[]
  }
}

export type ModuleProviderBinding<Provider = unknown> = {
  moduleId: string
  providerId: string
  surfaces: readonly string[]
  capabilities: Readonly<Record<string, ModuleCapabilityDescriptor>>
  sourceDetail?: ModuleCapabilityDescriptor
  provider: Provider
}

const selectedProviders = new Map<string, ModuleProviderBinding>()

/** Selects exactly the supplied provider for its module. No implicit fallback is performed. */
export function selectModuleProvider<Provider>(binding: ModuleProviderBinding<Provider>): void {
  selectedProviders.set(binding.moduleId, binding)
}

/** Returns the explicitly selected binding or fails closed when no provider was selected. */
export function getSelectedModuleProvider<Provider = unknown>(moduleId: string): ModuleProviderBinding<Provider> {
  const binding = selectedProviders.get(moduleId)
  if (!binding) throw new Error(`Module provider '${moduleId}' has not been selected.`)
  return binding as ModuleProviderBinding<Provider>
}
