import { describe, expect, it } from 'vitest'

import {
  isSecondOutsideSelectionPress,
  OUTSIDE_SELECTION_DISMISS_WINDOW_MS,
} from './map-selection-dismissal.js'

describe('outside selection dismissal', () => {
  it('requires a second press within the dismissal window', () => {
    expect(isSecondOutsideSelectionPress(null, 1_000)).toBe(false)
    expect(isSecondOutsideSelectionPress(1_000, 1_500)).toBe(true)
  })

  it('does not dismiss after the window or from an invalid timestamp', () => {
    expect(isSecondOutsideSelectionPress(1_000, 1_000 + OUTSIDE_SELECTION_DISMISS_WINDOW_MS + 1)).toBe(
      false,
    )
    expect(isSecondOutsideSelectionPress(1_000, 999)).toBe(false)
  })
})
