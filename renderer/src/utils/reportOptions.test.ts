import { describe, expect, test } from 'vitest'
import { buildBarOption, buildPieOption, escapeTooltipText } from './reportOptions'

describe('chart tooltip text', () => {
  test('escapes HTML metacharacters in labels', () => {
    expect(escapeTooltipText(`<img src="x" onerror='alert(1)'>&`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;'
    )
  })

  test('escapes labels in axis and item tooltip HTML', () => {
    const malicious = '<img src=x onerror=alert(1)>'
    const axis = buildBarOption([{ label: malicious, value: 2 }], malicious).tooltip as any
    const axisHtml = axis.formatter([{
      marker: '<span class="marker"></span>',
      name: malicious,
      axisValueLabel: malicious,
      seriesName: malicious,
      value: 2,
    }]) as string
    expect(axisHtml).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(axisHtml).not.toContain(malicious)
    expect(axisHtml).toContain('<span class="marker"></span>')

    const item = buildPieOption([{ name: malicious, value: 2 }]).tooltip as any
    const itemHtml = item.formatter({ marker: '', name: malicious, value: 2, percent: 100 }) as string
    expect(itemHtml).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(itemHtml).not.toContain(malicious)
  })
})
