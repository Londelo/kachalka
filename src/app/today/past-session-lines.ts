import { collapseSetFigures } from '@/features/workout/workout-entity'

export type PastSessionSourceLine = {
  weight: number
  reps: number
  count?: number
}

export type PastSessionLine = {
  weight: number
  reps: number
  count: number
}

function carriesFigures(line: PastSessionSourceLine): boolean {
  return line.weight !== 0 || line.reps !== 0
}

function hasRenderableFigures(line: PastSessionSourceLine): boolean {
  return Number.isFinite(line.weight) && Number.isFinite(line.reps)
}

/**
 * Turns the previous session's stored lines into the read-only rows the past
 * session region renders.
 *
 * Folding belongs to `collapseSetFigures` alone: this function sums nothing,
 * sorts nothing, and supplies no count of its own. A line that arrives without
 * a `count` key is handed over without one, so the domain's own "no count means
 * one set" rule is what produces the number on the row.
 *
 * What is decided here is only which lines reach the rule. A line carrying no
 * figures is dropped, so a stored log of nothing but blanks reads as no
 * previous session at all; a line whose weight or reps is not a finite number
 * is dropped too, because this view is read-only and has no error surface a
 * lifter could act on.
 */
export function buildPastSessionLines(
  lastLog: PastSessionSourceLine[] | null | undefined,
): PastSessionLine[] {
  if (!lastLog) return []

  const survivors = lastLog.filter(
    (line) => carriesFigures(line) && hasRenderableFigures(line),
  )

  return collapseSetFigures(survivors)
}
