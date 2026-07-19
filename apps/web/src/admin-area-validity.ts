import type { AdminArea } from '@dove/contracts'

export function isAreaEffective(area: AdminArea, periodStart: string, periodEnd: string): boolean {
  if (!periodStart || !periodEnd || periodEnd < periodStart) return false
  return area.validFrom <= periodEnd && (!area.validTo || area.validTo >= periodStart)
}

export function effectiveAreas(
  areas: AdminArea[],
  periodStart: string,
  periodEnd: string,
): AdminArea[] {
  return areas
    .filter((area) => isAreaEffective(area, periodStart, periodEnd))
    .toSorted(
      (left, right) =>
        left.name.localeCompare(right.name, 'vi') || right.validFrom.localeCompare(left.validFrom),
    )
}

export function areaValidityLabel(area: AdminArea): string {
  return `${area.name} · hiệu lực ${area.validFrom}${area.validTo ? `–${area.validTo}` : '–nay'}`
}
