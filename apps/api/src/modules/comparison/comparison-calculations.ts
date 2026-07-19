import type {
  ComparisonAggregate,
  ComparisonItem,
  ComparisonThreshold,
  SourceQuantityKind,
} from '@dove/contracts'

export function compareQuantities(
  inspected: number,
  source: number | null,
  threshold: ComparisonThreshold,
) {
  if (source === null)
    return {
      difference: null,
      absoluteDifference: null,
      differencePercent: null,
      status: 'no_source_baseline' as const,
    }
  const difference = inspected - source
  const absoluteDifference = Math.abs(difference)
  const differencePercent = source === 0 ? null : (difference / source) * 100
  if (source === 0)
    return {
      difference,
      absoluteDifference,
      differencePercent,
      status: 'no_source_baseline' as const,
    }
  const warning =
    (threshold.absolute !== undefined && absoluteDifference > threshold.absolute) ||
    (threshold.percent !== undefined && Math.abs(differencePercent!) > threshold.percent)
  return {
    difference,
    absoluteDifference,
    differencePercent,
    status: warning ? ('warning' as const) : ('within_threshold' as const),
  }
}

export function aggregateComparisons(items: ComparisonItem[]): ComparisonAggregate[] {
  const work = new Map<
    string,
    {
      groupId: string
      groupName: string
      sourceKind: SourceQuantityKind
      unit: string
      sourceQuantity: number
      inspectedQuantity: number
    }
  >()
  for (const item of items) {
    if (!item.sourceKind || item.sourceQuantity === null) continue
    const key = `${item.groupId}|${item.sourceKind}|${item.unit}|${item.workItemId}`
    const current = work.get(key)
    work.set(key, {
      groupId: item.groupId,
      groupName: item.groupName,
      sourceKind: item.sourceKind,
      unit: item.unit,
      sourceQuantity: (current?.sourceQuantity ?? 0) + item.sourceQuantity,
      inspectedQuantity: item.inspectedQuantity,
    })
  }
  const grouped = new Map<string, ComparisonAggregate>()
  for (const item of work.values()) {
    const key = `${item.groupId}|${item.sourceKind}|${item.unit}`
    const current = grouped.get(key)
    const sourceQuantity = (current?.sourceQuantity ?? 0) + item.sourceQuantity
    const inspectedQuantity = (current?.inspectedQuantity ?? 0) + item.inspectedQuantity
    grouped.set(key, {
      groupId: item.groupId,
      groupName: item.groupName,
      sourceKind: item.sourceKind,
      unit: item.unit,
      sourceQuantity,
      inspectedQuantity,
      difference: inspectedQuantity - sourceQuantity,
      differencePercent:
        sourceQuantity === 0 ? null : ((inspectedQuantity - sourceQuantity) / sourceQuantity) * 100,
    })
  }
  const groupRows = [...grouped.values()]
  const caseRows = new Map<string, ComparisonAggregate>()
  for (const item of groupRows) {
    const key = `${item.sourceKind}|${item.unit}`
    const current = caseRows.get(key)
    const sourceQuantity = (current?.sourceQuantity ?? 0) + item.sourceQuantity
    const inspectedQuantity = (current?.inspectedQuantity ?? 0) + item.inspectedQuantity
    caseRows.set(key, {
      groupId: null,
      groupName: 'Toàn hồ sơ',
      sourceKind: item.sourceKind,
      unit: item.unit,
      sourceQuantity,
      inspectedQuantity,
      difference: inspectedQuantity - sourceQuantity,
      differencePercent:
        sourceQuantity === 0 ? null : ((inspectedQuantity - sourceQuantity) / sourceQuantity) * 100,
    })
  }
  return [...groupRows, ...caseRows.values()]
}
