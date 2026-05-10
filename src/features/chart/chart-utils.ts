import type { ChartBarData, ChartDataPoint, TimeGranularity } from '@/features/chart/chart-entity'
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
      const allSets = R.flatten(R.map((e) => e.sets, entries))
      const exerciseMap = R.reduce(
        (acc: Record<string, { name: string; sets: typeof entries[0]['sets'] }>, entry) => {
          return R.reduce(
            (innerAcc, ex) => {
              const existing = innerAcc[ex.name]
              if (existing) {
                existing.sets = R.concat(existing.sets, ex.sets)
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
      const exercises = R.toPairs(exerciseMap).map(([, v]) => v)
      return {
        date: entries[0].date,
        volume: totalVolume,
        tooltipData: { sets: allSets, totalVolume },
        exercises,
      }
    },
    pairs,
  )

  return R.sortBy((d) => d.date, result)
}
