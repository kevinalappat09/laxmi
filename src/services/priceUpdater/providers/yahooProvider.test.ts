import YahooFinanceModule from 'yahoo-finance2'
import { YahooProviderImpl } from './yahooProvider'

jest.mock('yahoo-finance2')

describe('YahooProviderImpl', () => {
    let provider: YahooProviderImpl
    let mockQuote: jest.Mock

    beforeEach(() => {
        mockQuote = jest.fn()
        // The constructor is mocked; set up the instance's quote method
        ;(YahooFinanceModule as jest.MockedClass<typeof YahooFinanceModule>)
            .mockImplementation(() => ({ quote: mockQuote } as any))
        provider = new YahooProviderImpl()
        jest.clearAllMocks()
        // Re-assign after clearAllMocks since the instance was already created
        mockQuote = jest.fn()
        ;(provider as any).yf.quote = mockQuote
    })

    describe('getLatestPrice', () => {
        it('returns regularMarketPrice from a mocked quote response', async () => {
            mockQuote.mockResolvedValueOnce({ regularMarketPrice: 1523.45 })

            const price = await provider.getLatestPrice('INFY.NS')
            expect(price).toBe(1523.45)
            expect(mockQuote).toHaveBeenCalledWith('INFY.NS')
        })

        it('throws with a descriptive message when regularMarketPrice is null', async () => {
            mockQuote.mockResolvedValueOnce({ regularMarketPrice: null })

            await expect(provider.getLatestPrice('INFY.NS')).rejects.toThrow(
                'Yahoo Finance returned no price for INFY.NS'
            )
        })

        it('propagates error when yahooFinance.quote throws', async () => {
            mockQuote.mockRejectedValueOnce(new Error('Network timeout'))

            await expect(provider.getLatestPrice('INFY.NS')).rejects.toThrow('Network timeout')
        })
    })

    describe('getNavForDate', () => {
        it('throws as not implemented for Yahoo provider', async () => {
            await expect(provider.getNavForDate('INFY.NS', '2026-06-02')).rejects.toThrow(
                'getNavForDate not implemented for Yahoo provider'
            )
        })
    })
})
