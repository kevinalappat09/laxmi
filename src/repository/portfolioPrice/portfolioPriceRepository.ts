/**
 * @module portfolioPriceRepository
 * @description Provides direct database access for portfolio price history.
 * @stability experimental
 */

import { SQLiteDatabase } from "../../database/databaseService";

export interface PriceHistoryRow {
    portfolioAssetId: number;
    price: number;
    currency: string;
    recordedDate: string;
}

export interface PortfolioPriceRepository {
    upsertDailyPrice(assetId: number, price: number, currency: string, date: string): void;
    getHistoryByAsset(assetId: number, fromDate: string, toDate: string): PriceHistoryRow[];
    getAllHistoryFrom(fromDate: string): PriceHistoryRow[];
    getLatestBefore(assetId: number, beforeDate: string): number | null;
    getNavForDate(assetId: number, date: string): number | null;
}

export class PortfolioPriceRepositoryImpl implements PortfolioPriceRepository {
    constructor(private db: SQLiteDatabase) {}

    upsertDailyPrice(assetId: number, price: number, currency: string, date: string): void {
        const now = new Date().toISOString();
        this.db.prepare(`
            INSERT OR REPLACE INTO portfolio_price_history
                (portfolio_asset_id, price, currency, recorded_date, created_on)
            VALUES (?, ?, ?, ?, ?)
        `).run(assetId, price, currency, date, now);
    }

    getHistoryByAsset(assetId: number, fromDate: string, toDate: string): PriceHistoryRow[] {
        const rows = this.db.prepare(`
            SELECT * FROM portfolio_price_history
            WHERE portfolio_asset_id = ?
              AND recorded_date >= ?
              AND recorded_date <= ?
            ORDER BY recorded_date ASC
        `).all(assetId, fromDate, toDate) as any[];

        return rows.map((r) => this.mapRow(r));
    }

    getAllHistoryFrom(fromDate: string): PriceHistoryRow[] {
        const rows = this.db.prepare(`
            SELECT * FROM portfolio_price_history
            WHERE recorded_date >= ?
            ORDER BY recorded_date ASC, portfolio_asset_id ASC
        `).all(fromDate) as any[];

        return rows.map((r) => this.mapRow(r));
    }

    getLatestBefore(assetId: number, beforeDate: string): number | null {
        const row = this.db.prepare(`
            SELECT price FROM portfolio_price_history
            WHERE portfolio_asset_id = ? AND recorded_date < ?
            ORDER BY recorded_date DESC
            LIMIT 1
        `).get(assetId, beforeDate) as any;

        return row ? (row.price as number) : null;
    }

    getNavForDate(assetId: number, date: string): number | null {
        const row = this.db.prepare(`
            SELECT price FROM portfolio_price_history
            WHERE portfolio_asset_id = ? AND recorded_date = ?
        `).get(assetId, date) as any;

        return row ? (row.price as number) : null;
    }

    private mapRow(row: any): PriceHistoryRow {
        return {
            portfolioAssetId: row.portfolio_asset_id,
            price: row.price,
            currency: row.currency,
            recordedDate: row.recorded_date,
        };
    }
}
