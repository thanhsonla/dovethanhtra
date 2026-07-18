export interface HistoryState<T> {
  future: T[]
  past: T[]
  present: T
}

export function createHistory<T>(initial: T): HistoryState<T> {
  return { future: [], past: [], present: initial }
}

export function pushHistory<T>(history: HistoryState<T>, value: T): HistoryState<T> {
  return { future: [], past: [...history.past, history.present], present: value }
}

export function undoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) return history
  return {
    future: [history.present, ...history.future],
    past: history.past.slice(0, -1),
    present: previous,
  }
}

export function redoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  const next = history.future[0]
  if (next === undefined) return history
  return {
    future: history.future.slice(1),
    past: [...history.past, history.present],
    present: next,
  }
}
