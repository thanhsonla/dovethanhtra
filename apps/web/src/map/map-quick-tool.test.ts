import type { WorkItem, WorkType } from '@dove/contracts'
import { describe, expect, it } from 'vitest'

import { mapModeLabel, quickToolDecision, quickToolWork } from './map-quick-tool.js'

const workTypes = [
  { id: 'line-type', measurementKind: 'line' },
  { id: 'area-type', measurementKind: 'area' },
] as WorkType[]
const workItems = [
  { id: 'line-work', workTypeId: 'line-type' },
  { id: 'area-work', workTypeId: 'area-type' },
] as WorkItem[]

describe('quick map tool selection', () => {
  it('keeps a compatible active work and otherwise finds the first compatible work', () => {
    expect(quickToolWork('line', workItems[0]!, workItems, workTypes)?.id).toBe('line-work')
    expect(quickToolWork('area', workItems[0]!, workItems, workTypes)?.id).toBe('area-work')
    expect(quickToolWork('point', workItems[0]!, workItems, workTypes)).toBeNull()
  })

  it('provides concise Vietnamese mode labels', () => {
    expect(mapModeLabel('view')).toBe('Xem')
    expect(mapModeLabel('area')).toBe('Vẽ vùng')
  })

  it('does not start a tool for a locked case or missing compatible work', () => {
    expect(quickToolDecision('line', true, null, workItems, workTypes).target).toBeUndefined()
    expect(quickToolDecision('point', false, null, workItems, workTypes).openData).toBe(true)
  })
})
