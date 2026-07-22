import { describe, expect, it, vi } from 'vitest'

import { handleMapShortcut } from './drawing-toolbar.js'

function shortcutEvent(
  key: string,
  options: Partial<{
    ctrlKey: boolean
    metaKey: boolean
    repeat: boolean
    shiftKey: boolean
    target: EventTarget | null
  }> = {},
) {
  const state = { prevented: false }
  return {
    event: {
      altKey: false,
      ctrlKey: options.ctrlKey ?? false,
      key,
      metaKey: options.metaKey ?? false,
      preventDefault: () => {
        state.prevented = true
      },
      repeat: options.repeat ?? false,
      shiftKey: options.shiftKey ?? false,
      target: options.target ?? null,
    },
    state,
  }
}

function actions() {
  return {
    canDelete: true,
    canFinish: true,
    canUndo: true,
    onDelete: vi.fn(),
    onFinish: vi.fn(),
    onStart: vi.fn(),
    onUndo: vi.fn(),
  }
}

describe('map keyboard shortcuts', () => {
  it.each([
    ['p', 'point'],
    ['d', 'line'],
    ['a', 'area'],
  ] as const)('starts %s drawing immediately', (key, mode) => {
    const input = shortcutEvent(key)
    const callbacks = actions()

    expect(handleMapShortcut(input.event, callbacks)).toBe(true)
    expect(input.state.prevented).toBe(true)
    expect(callbacks.onStart).toHaveBeenCalledWith(mode)
  })

  it('maps Delete, Cmd+Z and Cmd+S to toolbar actions', () => {
    const callbacks = actions()
    handleMapShortcut(shortcutEvent('Delete').event, callbacks)
    handleMapShortcut(shortcutEvent('z', { metaKey: true }).event, callbacks)
    handleMapShortcut(shortcutEvent('s', { metaKey: true }).event, callbacks)

    expect(callbacks.onDelete).toHaveBeenCalledOnce()
    expect(callbacks.onUndo).toHaveBeenCalledOnce()
    expect(callbacks.onFinish).toHaveBeenCalledOnce()
  })

  it('does not trigger shortcuts while entering form data', () => {
    const callbacks = actions()
    const input = shortcutEvent('a', {
      target: { tagName: 'INPUT' } as unknown as EventTarget,
    })

    expect(handleMapShortcut(input.event, callbacks)).toBe(false)
    expect(input.state.prevented).toBe(false)
    expect(callbacks.onStart).not.toHaveBeenCalled()
  })

  it('does not finish, undo or delete when the corresponding action is unavailable', () => {
    const callbacks = { ...actions(), canDelete: false, canFinish: false, canUndo: false }
    handleMapShortcut(shortcutEvent('Delete').event, callbacks)
    handleMapShortcut(shortcutEvent('z', { ctrlKey: true }).event, callbacks)
    handleMapShortcut(shortcutEvent('s', { ctrlKey: true }).event, callbacks)

    expect(callbacks.onDelete).not.toHaveBeenCalled()
    expect(callbacks.onUndo).not.toHaveBeenCalled()
    expect(callbacks.onFinish).not.toHaveBeenCalled()
  })
})
