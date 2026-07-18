import { describe, expect, it } from 'vitest'

import { createHistory, pushHistory, redoHistory, undoHistory } from './geometry-history.js'

describe('geometry history', () => {
  it('supports undo and redo without mutating the current value', () => {
    const first = pushHistory(createHistory<number[]>([]), [1])
    const second = pushHistory(first, [1, 2])
    const undone = undoHistory(second)
    expect(undone.present).toEqual([1])
    expect(redoHistory(undone).present).toEqual([1, 2])
    expect(second.present).toEqual([1, 2])
  })

  it('clears redo history after a new edit', () => {
    const state = undoHistory(pushHistory(pushHistory(createHistory(0), 1), 2))
    expect(pushHistory(state, 3).future).toEqual([])
  })
})
