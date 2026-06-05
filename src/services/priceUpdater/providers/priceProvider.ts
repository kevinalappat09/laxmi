/**
 * @module priceProvider
 * @description Defines the PriceProvider interface for all asset price data sources.
 * @stability experimental
 * @extension-points
 * - PriceProvider — implement to add a new data source
 * - Register in PriceUpdaterServiceImpl.getProvider()
 */

export interface PriceProvider {
    /** Get the latest available price for a given source identifier */
    getLatestPrice(sourceId: string): Promise<number>
    /**
     * Get the NAV for a specific date. Used by SIP processing to find the due-date NAV.
     * Returns the NAV for `date` if available, or the nearest available date on or after `date`
     * (matching how Indian SIPs handle holiday dates — allotment happens at next business day NAV).
     * Returns null if no price data is available at all.
     */
    getNavForDate(sourceId: string, date: string): Promise<number | null>
}
