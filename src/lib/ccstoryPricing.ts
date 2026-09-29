/** Explain incomplete prices without implying the whole model subtotal is absent. */
export function formatUnpricedModelCostNote(models: string[]): string | null {
  if (models.length === 0) return null
  return `費率未完整的模型：${models.join("、")}；成本只計入已知費率部分，未知部分未計入。`
}
