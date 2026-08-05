import type { EChartsOption } from 'echarts'
import { OTHER_SERIES_KEY } from './chartUtils'
import { formatCurrency, formatCurrencyCompact } from './formatters'

export const CHART_HEIGHT = 320

const CHART_FONT_FAMILY = 'calibre, Inter, sans-serif'

/**
 * Explicit categorical ramp. Theme tokens are deliberately not used here: several of them
 * alias the same hex value per theme, which silently collapsed the palette to five colors.
 */
const SERIES_COLORS = [
  '#479ffa',
  '#d6fe51',
  '#4ebe96',
  '#ffa16c',
  '#c3b1e1',
  '#f2799e',
  '#5fd0e8',
  '#ffd166',
  '#8fd25f',
  '#ff8b6b',
  '#9d8df1',
  '#3fbfbf',
  '#b6d6ff',
  '#c9a227',
  '#7fa1ff',
  '#e26d8b',
]

const OTHER_SERIES_COLOR = '#6b7280'

const SHOW_LINE_SYMBOL_MAX_POINTS = 20

function readThemeColor(token: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback

  const rootValue = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  if (rootValue) return rootValue

  const bodyValue = getComputedStyle(document.body).getPropertyValue(token).trim()
  return bodyValue || fallback
}

function getChartPalette() {
  return {
    seriesColors: SERIES_COLORS,
    incomeColor: readThemeColor('--color-positive', '#4ebe96'),
    expenseColor: readThemeColor('--color-negative', '#ffa16c'),
    gridColor: readThemeColor('--color-border-subtle', 'rgba(255, 255, 255, 0.06)'),
    axisTextColor: readThemeColor('--color-text-secondary', '#868f97'),
    headingColor: readThemeColor('--color-text-heading', '#ffffff'),
    tooltipBg: readThemeColor('--color-bg-input', '#191919'),
    tooltipBorder: readThemeColor('--color-border', '#2a2a2a'),
    tooltipText: readThemeColor('--color-text-primary', '#e6e6e6'),
    pieStroke: readThemeColor('--color-bg-card', '#131313'),
  }
}

/** Semantic colors for callers that build their own series, keeping them on the shared theme. */
export function getSemanticChartColors() {
  const palette = getChartPalette()
  return {
    income: palette.incomeColor,
    expense: palette.expenseColor,
    neutral: OTHER_SERIES_COLOR,
    accent: SERIES_COLORS[0],
  }
}

export type SeriesColorMap = Record<string, string>

/** Flattens key lists from several charts into one de-duplicated, order-preserving list. */
export function mergeSeriesKeys(...keyLists: string[][]): string[] {
  const seen = new Set<string>()
  const merged: string[] = []

  keyLists.forEach((keys) => {
    keys.forEach((key) => {
      if (seen.has(key)) return
      seen.add(key)
      merged.push(key)
    })
  })

  return merged
}

/**
 * Maps each key to a stable color so the same series keeps its color across charts on a tab.
 * The collapsed "Other" bucket always reads as neutral grey instead of consuming a hue.
 */
export function assignSeriesColors(keys: string[]): SeriesColorMap {
  const colorMap: SeriesColorMap = {}
  let paletteIndex = 0

  keys.forEach((key) => {
    if (key === OTHER_SERIES_KEY) {
      colorMap[key] = OTHER_SERIES_COLOR
      return
    }

    colorMap[key] = SERIES_COLORS[paletteIndex % SERIES_COLORS.length]
    paletteIndex += 1
  })

  return colorMap
}

function resolveColor(key: string, index: number, colorMap?: SeriesColorMap): string {
  if (colorMap?.[key]) return colorMap[key]
  if (key === OTHER_SERIES_KEY) return OTHER_SERIES_COLOR
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

type Palette = ReturnType<typeof getChartPalette>

/** Not every report is denominated in money: budget counts and utilization need their own units. */
export type ValueFormat = 'currency' | 'percent' | 'count'

function formatAxisValue(value: number, format: ValueFormat): string {
  if (format === 'percent') return `${value}%`
  if (format === 'count') return String(value)
  return formatCurrencyCompact(value)
}

function formatPointValue(value: number, format: ValueFormat): string {
  if (format === 'percent') return `${Number(value).toFixed(1)}%`
  if (format === 'count') return String(value)
  return formatCurrency(value)
}

function buildTooltip(
  palette: Palette,
  trigger: 'axis' | 'item',
  format: ValueFormat = 'currency'
): EChartsOption['tooltip'] {
  return {
    trigger,
    backgroundColor: palette.tooltipBg,
    borderColor: palette.tooltipBorder,
    textStyle: {
      color: palette.tooltipText,
      fontFamily: CHART_FONT_FAMILY,
    },
    axisPointer: {
      type: trigger === 'axis' ? 'shadow' : 'none',
      shadowStyle: { color: 'rgba(255, 255, 255, 0.04)' },
    },
    formatter: (params: any) => {
      if (trigger === 'item') {
        return `${params.marker} ${params.name}<br/><strong>${formatPointValue(params.value, format)}</strong> (${params.percent}%)`
      }

      const entries = (Array.isArray(params) ? params : [params]).slice()
      if (entries.length === 0) return ''

      entries.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      const header = entries[0].axisValueLabel ?? entries[0].name
      const rows = entries.map((entry) => {
        const value = entry.value == null ? '--' : formatPointValue(entry.value, format)
        return `${entry.marker} ${entry.seriesName}: <strong>${value}</strong>`
      })

      return [header, ...rows].join('<br/>')
    },
  }
}

function buildTopLegend(palette: Palette): EChartsOption['legend'] {
  return {
    type: 'scroll',
    top: 0,
    left: 'center',
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 16,
    pageIconColor: palette.axisTextColor,
    pageIconInactiveColor: palette.gridColor,
    pageTextStyle: { color: palette.axisTextColor },
    textStyle: {
      color: palette.axisTextColor,
      fontFamily: CHART_FONT_FAMILY,
      overflow: 'truncate',
      width: 140,
    },
  }
}

function buildSideLegend(palette: Palette): EChartsOption['legend'] {
  return {
    type: 'scroll',
    orient: 'vertical',
    right: 8,
    top: 'middle',
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 12,
    pageIconColor: palette.axisTextColor,
    pageIconInactiveColor: palette.gridColor,
    pageTextStyle: { color: palette.axisTextColor },
    textStyle: {
      color: palette.axisTextColor,
      fontFamily: CHART_FONT_FAMILY,
      overflow: 'truncate',
      width: 130,
    },
  }
}

/**
 * Shared cartesian frame. `grid.top` clears the legend band so series never draw over it.
 */
function buildCartesianBase(
  palette: Palette,
  labels: string[],
  format: ValueFormat = 'currency'
): EChartsOption {
  return {
    animation: true,
    color: SERIES_COLORS,
    tooltip: buildTooltip(palette, 'axis', format),
    legend: buildTopLegend(palette),
    grid: { left: 8, right: 16, top: 48, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: true,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: palette.gridColor } },
      axisLabel: {
        color: palette.axisTextColor,
        fontFamily: CHART_FONT_FAMILY,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.gridColor } },
      axisLabel: {
        color: palette.axisTextColor,
        fontFamily: CHART_FONT_FAMILY,
        formatter: (value: number) => formatAxisValue(value, format),
      },
    },
  }
}

export interface PieDatum {
  name: string
  value: number
}

export function buildIncomeExpenseOption(
  data: Array<{ label: string; income: number; expense: number }>
): EChartsOption {
  const palette = getChartPalette()

  return {
    ...buildCartesianBase(palette, data.map((item) => item.label)),
    series: [
      {
        type: 'bar',
        name: 'Income',
        data: data.map((item) => item.income),
        barMaxWidth: 28,
        emphasis: { focus: 'series' },
        itemStyle: { color: palette.incomeColor, borderRadius: [4, 4, 0, 0] },
      },
      {
        type: 'bar',
        name: 'Expense',
        data: data.map((item) => item.expense),
        barMaxWidth: 28,
        emphasis: { focus: 'series' },
        itemStyle: { color: palette.expenseColor, borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
}

export function buildMultiLineOption(
  data: Array<{ label: string } & Record<string, number | string>>,
  seriesKeys: string[],
  colorMap?: SeriesColorMap
): EChartsOption {
  const palette = getChartPalette()
  const showSymbol = data.length <= SHOW_LINE_SYMBOL_MAX_POINTS

  return {
    ...buildCartesianBase(palette, data.map((row) => String(row.label))),
    series: seriesKeys.map((key, index) => {
      const color = resolveColor(key, index, colorMap)

      return {
        type: 'line',
        name: key,
        smooth: true,
        showSymbol,
        symbol: 'circle',
        symbolSize: 5,
        emphasis: { focus: 'series' },
        lineStyle: { width: 2, color },
        itemStyle: { color },
        data: data.map((row) => (typeof row[key] === 'number' ? (row[key] as number) : 0)),
      }
    }),
  }
}

export function buildBarOption(
  data: Array<{ label: string; value: number }>,
  seriesName: string,
  options: { color?: string; valueFormat?: ValueFormat } = {}
): EChartsOption {
  const palette = getChartPalette()
  const base = buildCartesianBase(palette, data.map((item) => item.label), options.valueFormat)

  return {
    ...base,
    legend: { show: false },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    series: [
      {
        type: 'bar',
        name: seriesName,
        data: data.map((item) => item.value),
        barMaxWidth: 28,
        itemStyle: { color: options.color ?? SERIES_COLORS[0], borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
}

/** Bars colored by sign, for values that cross zero such as net cash flow. */
export function buildDivergingBarOption(
  data: Array<{ label: string; value: number }>,
  seriesName = 'Net'
): EChartsOption {
  const palette = getChartPalette()
  const base = buildCartesianBase(palette, data.map((item) => item.label))

  return {
    ...base,
    legend: { show: false },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    series: [
      {
        type: 'bar',
        name: seriesName,
        barMaxWidth: 28,
        data: data.map((item) => ({
          value: item.value,
          itemStyle: {
            color: item.value >= 0 ? palette.incomeColor : palette.expenseColor,
            borderRadius: item.value >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
          },
        })),
      },
    ],
  }
}

/** Line chart on a percentage axis. Null values leave a gap rather than plotting a misleading zero. */
export function buildPercentLineOption(
  data: Array<{ label: string; value: number | null }>,
  seriesName: string
): EChartsOption {
  const palette = getChartPalette()
  const base = buildCartesianBase(palette, data.map((item) => item.label), 'percent')
  const accent = SERIES_COLORS[0]

  return {
    ...base,
    legend: { show: false },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    series: [
      {
        type: 'line',
        name: seriesName,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        connectNulls: false,
        lineStyle: { width: 2, color: accent },
        itemStyle: { color: accent },
        areaStyle: { color: accent, opacity: 0.08 },
        data: data.map((item) => item.value),
      },
    ],
  }
}

export interface HorizontalBarSeries {
  name: string
  values: number[]
  color?: string
}

/**
 * Category axis on the left. Height is driven by the caller since the number of rows
 * varies, unlike the fixed-height cartesian charts.
 */
export function buildHorizontalBarOption(
  categories: string[],
  series: HorizontalBarSeries[],
  options: { stacked?: boolean } = {}
): EChartsOption {
  const palette = getChartPalette()
  const stack = options.stacked ? 'total' : undefined
  const lastIndex = series.length - 1

  return {
    animation: true,
    color: SERIES_COLORS,
    tooltip: buildTooltip(palette, 'axis'),
    legend: buildTopLegend(palette),
    grid: { left: 8, right: 24, top: 48, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.gridColor } },
      axisLabel: {
        color: palette.axisTextColor,
        fontFamily: CHART_FONT_FAMILY,
        formatter: (value: number) => formatCurrencyCompact(value),
      },
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: palette.gridColor } },
      axisLabel: {
        color: palette.axisTextColor,
        fontFamily: CHART_FONT_FAMILY,
        overflow: 'truncate',
        width: 140,
      },
    },
    series: series.map((entry, index) => ({
      type: 'bar',
      name: entry.name,
      data: entry.values,
      stack,
      barMaxWidth: 18,
      emphasis: { focus: 'series' },
      itemStyle: {
        color: entry.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
        // Only the outermost segment of a stack gets the rounded cap.
        borderRadius: !stack || index === lastIndex ? [0, 4, 4, 0] : 0,
      },
    })),
  }
}

export function buildPieOption(
  data: PieDatum[],
  colorMap?: SeriesColorMap,
  options: { valueFormat?: ValueFormat; totalLabel?: string } = {}
): EChartsOption {
  const palette = getChartPalette()
  const valueFormat = options.valueFormat ?? 'currency'
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return {
    animation: true,
    color: SERIES_COLORS,
    tooltip: buildTooltip(palette, 'item', valueFormat),
    legend: buildSideLegend(palette),
    title: {
      text: valueFormat === 'currency' ? formatCurrencyCompact(total) : String(total),
      subtext: options.totalLabel ?? 'Total',
      left: '32%',
      top: 'middle',
      textAlign: 'center',
      textStyle: {
        color: palette.headingColor,
        fontFamily: CHART_FONT_FAMILY,
        fontSize: 22,
        fontWeight: 600,
      },
      subtextStyle: {
        color: palette.axisTextColor,
        fontFamily: CHART_FONT_FAMILY,
        fontSize: 12,
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['32%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: palette.pieStroke,
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          focus: 'self',
          scaleSize: 6,
        },
        data: data.map((item, index) => ({
          ...item,
          itemStyle: { color: resolveColor(item.name, index, colorMap) },
        })),
      },
    ],
  }
}
