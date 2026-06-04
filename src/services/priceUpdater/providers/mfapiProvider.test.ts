import { MfapiProviderImpl } from './mfapiProvider'

describe('MfapiProviderImpl', () => {
    let provider: MfapiProviderImpl

    beforeEach(() => {
        provider = new MfapiProviderImpl()
        global.fetch = jest.fn()
    })

    afterEach(() => {
        jest.resetAllMocks()
    })

    describe('getLatestPrice', () => {
        it('parses data[0].nav string into a number correctly', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ status: 'SUCCESS', data: [{ date: '02-06-2026', nav: '892.45600' }] }),
            })

            const price = await provider.getLatestPrice('119551')
            expect(price).toBe(892.456)
        })

        it('throws when HTTP status is non-200', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 404,
            })

            await expect(provider.getLatestPrice('119551')).rejects.toThrow('MFAPI returned 404 for scheme code 119551')
        })

        it('throws when data array is empty', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ status: 'SUCCESS', data: [] }),
            })

            await expect(provider.getLatestPrice('119551')).rejects.toThrow('MFAPI returned empty data for scheme code 119551')
        })

        it('propagates network errors from fetch', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

            await expect(provider.getLatestPrice('119551')).rejects.toThrow('Network error')
        })
    })

    describe('getNavForDate', () => {
        const mockHistory = [
            { date: '03-06-2026', nav: '900.000' },
            { date: '02-06-2026', nav: '892.456' },
            { date: '30-05-2026', nav: '885.123' },
            { date: '29-05-2026', nav: '880.000' },
        ]

        it('returns nav when exact date match exists in history', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockHistory }),
            })

            const nav = await provider.getNavForDate('119551', '2026-06-02')
            expect(nav).toBe(892.456)
        })

        it('returns next business day nav when due date is a holiday (no exact match)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockHistory }),
            })

            // 2026-05-31 is a Sunday — no exact match; next available is 2026-06-02
            const nav = await provider.getNavForDate('119551', '2026-05-31')
            expect(nav).toBe(892.456)
        })

        it('returns null when no data is available at all', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [] }),
            })

            const nav = await provider.getNavForDate('119551', '2026-06-02')
            expect(nav).toBeNull()
        })

        it('returns null when fetch returns non-200', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 })

            const nav = await provider.getNavForDate('119551', '2026-06-02')
            expect(nav).toBeNull()
        })
    })

    describe('mfapiDateToISO (via getNavForDate)', () => {
        it('converts DD-MM-YYYY to YYYY-MM-DD for date comparison', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [{ date: '28-05-2026', nav: '1234.5678' }],
                }),
            })

            const nav = await provider.getNavForDate('119551', '2026-05-28')
            expect(nav).toBe(1234.5678)
        })
    })
})
