import type { EChartsOption } from 'echarts'

function readThemeColor(token: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback

  const rootValue = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  if (rootValue) return rootValue

  const bodyValue = getComputedStyle(document.body).getPropertyValue(token).trim()
  return bodyValue || fallback
}

function getChartPalette() {
  return {
    seriesColors: [
      readThemeColor('--color-cosmic-blue', '#479ffa'),
      readThemeColor('--color-vibrant-gradient-1', '#d6fe51'),
      readThemeColor('--color-positive', '#4ebe96'),
      readThemeColor('--color-negative', '#ffa16c'),
      readThemeColor('--color-cool-gradient-1', '#b6d6ff'),
      readThemeColor('--color-positive-alt', '#a3e4cb'),
      readThemeColor('--color-warn-gradient-1', '#ffd4b3'),
      readThemeColor('--color-accent-muted', '#c3b1e1'),
    ],
    incomeColor: readThemeColor('--color-positive', '#4ebe96'),
    expenseColor: readThemeColor('--color-negative', '#ffa16c'),
    gridColor: readThemeColor('--color-border-subtle', 'rgba(255, 255, 255, 0.06)'),
    axisTextColor: readThemeColor('--color-text-secondary', '#868f97'),
    tooltipBg: readThemeColor('--color-bg-input', '#191919'),
    tooltipBorder: readThemeColor('--color-border', '#2a2a2a'),
    tooltipText: readThemeColor('--color-text-primary', '#e6e6e6'),
    pieStroke: readThemeColor('--color-bg-app', '#111111'),
  }
}

function baseOption(): EChartsOption {
  const palette = getChartPalette()

  return {
    animation: true,
    color: palette.seriesColors,
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: {
        color: palette.tooltipText,
        fontFamily: 'calibre, Inter, sans-serif',
      },
    },
    grid: { left: 20, right: 20, top: 20, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      axisLine: { lineStyle: { color: palette.gridColor } },
      axisLabel: { color: palette.axisTextColor },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: palette.gridColor } },
      axisLabel: { color: palette.axisTextColor },
    },
  }
}

export interface PieDatum {
  name: string
  value: number
}

export function buildSingleBarOption(data: Array<{ label: string; value: number }>): EChartsOption {
  const palette = getChartPalette()

  return {
    ...baseOption(),
    xAxis: {
      ...(baseOption().xAxis as object),
      data: data.map((item) => item.label),
    },
    series: [
      {
        type: 'bar',
        name: 'Expense',
        data: data.map((item) => item.value),
        itemStyle: { color: palette.expenseColor, borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
}

export function buildIncomeExpenseOption(data: Array<{ label: string; income: number; expense: number }>): EChartsOption {
  const palette = getChartPalette()

  return {
    ...baseOption(),
    legend: {
      top: 0,
      type: 'scroll',
      pageIconColor: palette.axisTextColor,
      pageTextStyle: { color: palette.axisTextColor },
      textStyle: { color: palette.axisTextColor },
    },
    xAxis: {
      ...(baseOption().xAxis as object),
      data: data.map((item) => item.label),
    },
    series: [
      {
        type: 'bar',
        name: 'Income',
        data: data.map((item) => item.income),
        itemStyle: { color: palette.incomeColor, borderRadius: [4, 4, 0, 0] },
      },
      {
        type: 'bar',
        name: 'Expense',
        data: data.map((item) => item.expense),
        itemStyle: { color: palette.expenseColor, borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
}

export function buildMultiLineOption(
  data: Array<{ label: string } & Record<string, number | string>>,
  seriesKeys: string[]
): EChartsOption {
  const palette = getChartPalette()

  return {
    ...baseOption(),
    legend: {
      top: 0,
      type: 'scroll',
      pageIconColor: palette.axisTextColor,
      pageTextStyle: { color: palette.axisTextColor },
      textStyle: { color: palette.axisTextColor },
    },
    xAxis: {
      ...(baseOption().xAxis as object),
      data: data.map((row) => row.label),
    },
    series: seriesKeys.map((key, index) => ({
      type: 'line',
      name: key,
      smooth: true,
      symbolSize: 6,
      lineStyle: {
        width: 2,
        color: palette.seriesColors[index % palette.seriesColors.length],
      },
      itemStyle: {
        color: palette.seriesColors[index % palette.seriesColors.length],
      },
      data: data.map((row) => (typeof row[key] === 'number' ? (row[key] as number) : 0)),
    })),
  }
}

export function buildPieOption(data: PieDatum[]): EChartsOption {
  const palette = getChartPalette()

  return {
    animation: true,
    color: palette.seriesColors,
    tooltip: {
      trigger: 'item',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: {
        color: palette.tooltipText,
        fontFamily: 'calibre, Inter, sans-serif',
      },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      pageIconColor: palette.axisTextColor,
      pageTextStyle: { color: palette.axisTextColor },
      textStyle: { color: palette.axisTextColor },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '72%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: palette.pieStroke,
          borderWidth: 2,
        },
        label: {
          color: palette.axisTextColor,
        },
        data,
      },
    ],
  }
}
