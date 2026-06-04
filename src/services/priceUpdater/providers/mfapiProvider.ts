import type { PriceProvider } from './priceProvider'

interface MfapiHistoricalEntry { date: string; nav: string }  // date: "DD-MM-YYYY"

export class MfapiProviderImpl implements PriceProvider {
    async getLatestPrice(schemeCode: string): Promise<number> {
        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`)
        if (!res.ok) {
            throw new Error(`MFAPI returned ${res.status} for scheme code ${schemeCode}`)
        }
        const json = await res.json() as { status: string; data: MfapiHistoricalEntry[] }
        if (!json.data?.length) {
            throw new Error(`MFAPI returned empty data for scheme code ${schemeCode}`)
        }
        return parseFloat(json.data[0].nav)
    }

    async getNavForDate(schemeCode: string, isoDate: string): Promise<number | null> {
        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`)
        if (!res.ok) return null

        const json = await res.json() as { data: MfapiHistoricalEntry[] }
        if (!json.data?.length) return null

        const entries = json.data.map(e => ({
            iso: this.mfapiDateToISO(e.date),
            nav: parseFloat(e.nav),
        }))

        const exact = entries.find(e => e.iso === isoDate)
        if (exact) return exact.nav

        // Holiday/weekend — return next available business day NAV on or after isoDate.
        // entries are sorted descending by date, so reverse to find first date >= isoDate.
        const next = [...entries].reverse().find(e => e.iso >= isoDate)
        return next?.nav ?? null
    }

    private mfapiDateToISO(ddmmyyyy: string): string {
        const [dd, mm, yyyy] = ddmmyyyy.split('-')
        return `${yyyy}-${mm}-${dd}`
    }
}
