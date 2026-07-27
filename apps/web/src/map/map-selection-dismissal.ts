export const OUTSIDE_SELECTION_DISMISS_WINDOW_MS = 750

export function isSecondOutsideSelectionPress(
  previousPressAt: number | null,
  currentPressAt: number,
): boolean {
  return (
    previousPressAt !== null &&
    currentPressAt >= previousPressAt &&
    currentPressAt - previousPressAt <= OUTSIDE_SELECTION_DISMISS_WINDOW_MS
  )
}
