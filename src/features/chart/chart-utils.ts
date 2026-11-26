import type { ChartBarData, ChartDataPoint, TimeGranularity } from '@/features/chart/chart-entity'
import { collapseSets, getSetCount } from '@/features/workout/workout-entity'
import * as R from 'ramda'

function toISOWeekKey(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayNum = date.getDay() || 7
  date.setDate(date.getDate() + 4 - dayNum)
  const yearStart = new Date(date.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function toMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function groupByGranularity(
  data: ChartDataPoint[],
  granularity: TimeGranularity,
): ChartBarData[] {
  const groupKey = granularity === 'session'
    ? (dp: ChartDataPoint) => dp.date
    : granularity === 'week'
      ? (dp: ChartDataPoint) => toISOWeekKey(dp.date)
      : (dp: ChartDataPoint) => toMonthKey(dp.date)

  const grouped = R.groupBy(groupKey, data)
  const pairs = R.toPairs(grouped) as [string, ChartDataPoint[]][]

  const result: ChartBarData[] = R.map(
    ([, entries]) => {
      const totalVolume = R.sum(R.map((e) => e.volume, entries))
      // These lines are flattened across every entry in the group, and a `week`
      // or `month` group is built with no exercise filter — so they belong to
      // different exercises. `collapseSets` keys on `weight,reps` alone and
      // carries no exercise identity, so folding here merged a Squat line and a
      // Bench line of the same work into one line owned by whichever arrived
      // first, while the sum below came out identical either way. The fold is
      // the write rule for one session's own lines; the per-exercise fold below
      // is where lines genuinely all belong to one named exercise. Each line is
      // copied rather than handed back by reference, so a bar never aliases the
      // data it was built from.
      const allLines = R.map((line) => ({ ...line }), R.flatten(R.map((e) => e.sets, entries)))
      const setCount = R.sum(R.map(getSetCount, allLines))
      const exerciseMap = R.reduce(
        (acc: Record<string, { name: string; sets: typeof entries[0]['sets'] }>, entry) => {
          return R.reduce(
            (innerAcc, ex) => {
              const existing = innerAcc[ex.name]
              if (existing) {
                existing.sets = [...existing.sets, ...ex.sets]
              } else {
                innerAcc[ex.name] = { name: ex.name, sets: [...ex.sets] }
              }
              return innerAcc
            },
            acc,
            entry.exercises,
          )
        },
        {},
        entries,
      )
      const exercises = R.toPairs(exerciseMap).map(([, v]) => {
        const sets = collapseSets(v.sets)
        return { name: v.name, sets, setCount: R.sum(R.map((s) => getSetCount(s), sets)) }
      })
      return {
        date: entries[0].date,
        volume: totalVolume,
        tooltipData: { sets: allLines, totalVolume, setCount },
        exercises,
      }
    },
    pairs,
  )

  return R.sortBy((d) => d.date, result)
}
