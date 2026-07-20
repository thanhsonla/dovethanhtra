import { describe, expect, it } from 'vitest'

import { createDrawingState, drawingReducer } from './drawing-state.js'

describe('drawing state machine', () => {
  it('adds vertices and moves backward/forward without changing coordinate order', () => {
    let state = createDrawingState()
    state = drawingReducer(state, { type: 'add', position: [104.6, 20.8] })
    state = drawingReducer(state, { type: 'add', position: [104.7, 20.9] })
    expect(state.history.present).toEqual([
      [104.6, 20.8],
      [104.7, 20.9],
    ])
    state = drawingReducer(state, { type: 'undo' })
    expect(state.history.present).toEqual([[104.6, 20.8]])
    state = drawingReducer(state, { type: 'redo' })
    expect(state.history.present).toHaveLength(2)
  })

  it('deletes only the selected vertex and allows undo', () => {
    let state = createDrawingState([
      [104.6, 20.8],
      [104.7, 20.9],
      [104.8, 21],
    ])
    state = drawingReducer(state, { type: 'select', index: 1 })
    state = drawingReducer(state, { type: 'delete-selected' })
    expect(state.history.present).toEqual([
      [104.6, 20.8],
      [104.8, 21],
    ])
    state = drawingReducer(state, { type: 'undo' })
    expect(state.history.present).toHaveLength(3)
  })

  it('ignores invalid selections and resets all history', () => {
    let state = drawingReducer(createDrawingState([[104.6, 20.8]]), {
      type: 'select',
      index: 4,
    })
    expect(drawingReducer(state, { type: 'delete-selected' })).toBe(state)
    state = drawingReducer(state, { type: 'reset' })
    expect(state).toEqual(createDrawingState())
  })
})
