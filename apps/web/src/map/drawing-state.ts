import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from './geometry-history.js'
import type { Position } from './measurement-map.js'

export interface DrawingState {
  history: HistoryState<Position[]>
  selectedIndex: number | null
}

export type DrawingAction =
  | { type: 'add'; position: Position }
  | { type: 'delete-selected' }
  | { type: 'insert-position'; index: number; position: Position }
  | { type: 'redo' }
  | { type: 'reset'; positions?: Position[] }
  | { type: 'select'; index: number | null }
  | { type: 'undo' }
  | { type: 'update-position'; index: number; position: Position }

export function createDrawingState(positions: Position[] = []): DrawingState {
  return { history: createHistory(positions), selectedIndex: null }
}

export function drawingReducer(state: DrawingState, action: DrawingAction): DrawingState {
  if (action.type === 'reset') return createDrawingState(action.positions ?? [])
  if (action.type === 'select') {
    const valid = action.index !== null && state.history.present[action.index] !== undefined
    return { ...state, selectedIndex: valid ? action.index : null }
  }
  if (action.type === 'add') {
    return {
      history: pushHistory(state.history, [...state.history.present, action.position]),
      selectedIndex: null,
    }
  }
  if (action.type === 'insert-position') {
    const updated = [...state.history.present]
    updated.splice(action.index, 0, action.position)
    return {
      history: pushHistory(state.history, updated),
      selectedIndex: action.index,
    }
  }
  if (action.type === 'update-position') {
    if (state.history.present[action.index] === undefined) return state
    const updated = [...state.history.present]
    updated[action.index] = action.position
    return {
      history: pushHistory(state.history, updated),
      selectedIndex: state.selectedIndex,
    }
  }
  if (action.type === 'delete-selected') {
    if (state.selectedIndex === null) return state
    return {
      history: pushHistory(
        state.history,
        state.history.present.filter((_, index) => index !== state.selectedIndex),
      ),
      selectedIndex: null,
    }
  }
  return {
    history: action.type === 'undo' ? undoHistory(state.history) : redoHistory(state.history),
    selectedIndex: null,
  }
}
