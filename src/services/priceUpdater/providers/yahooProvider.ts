import YahooFinanceModule from 'yahoo-finance2'
import type { PriceProvider } from './priceProvider'

export class YahooProviderImpl implements PriceProvider {
    private readonly yf = new YahooFinanceModule()

    async getLatestPrice(ticker: string): Promise<number> {
        const quote = await this.yf.quote(ticker)
        if (quote.regularMarketPrice == null) {
            throw new Error(`Yahoo Finance returned no price for ${ticker}`)
        }
        return quote.regularMarketPrice
    }

    async getNavForDate(_ticker: string, _isoDate: string): Promise<number | null> {
        // Stocks/ETFs don't have the same "SIP date" semantics as MFs.
        // Future: use yf.historical({ period1: isoDate, period2: isoDate })
        throw new Error(`getNavForDate not implemented for Yahoo provider — stocks do not support SIP`)
    }
}
