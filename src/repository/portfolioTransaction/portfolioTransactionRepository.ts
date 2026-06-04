/**
 * @module portfolioTransactionRepository
 * @description Provides direct database access for PortfolioTransaction entities and portfolio view queries.
 * @stability experimental
 */

import { SQLiteDatabase } from "../../database/databaseService";
import {
    CreatePortfolioTransactionRequest,
    PortfolioTransaction,
} from "../../types/portfolioTransaction";

export interface PortfolioHoldingRow {
    portfolioAssetId: number;
    totalUnits: number;
    totalUnitsAcquired: number;
    totalAcquisitionCost: number;
    totalSaleProceeds: number;
    totalUnitsSold: number;
}

export interface PortfolioSummaryRow extends PortfolioHoldingRow {
    assetId: number;
    name: string;
    category: string;
    type: string;
    currentPrice: number | null;
    currency: string;
    lastPriceUpdatedAt: string | null;
    avco: number;
    costBasis: number;
    currentValue: number | null;
    unrealizedPl: number | null;
    realizedPl: number;
}

export interface PortfolioTransactionRepository {
    create(request: CreatePortfolioTransactionRequest & { quantity: number }): PortfolioTransaction;
    deactivate(id: number): void;
    listByAsset(portfolioAssetId: number): PortfolioTransaction[];
    listAll(): PortfolioTransaction[];
    getHoldings(): PortfolioHoldingRow[];
    getSummary(): PortfolioSummaryRow[];
    getValueByAccount(accountId: number): number;
    getTotalUnitsHeld(portfolioAssetId: number): number;
}

export class PortfolioTransactionRepositoryImpl implements PortfolioTransactionRepository {
    constructor(private db: SQLiteDatabase) {}

    create(request: CreatePortfolioTransactionRequest & { quantity: number }): PortfolioTransaction {
        const now = new Date().toISOString();
        const result = this.db.prepare(`
            INSERT INTO portfolio_transactions (
                portfolio_asset_id, transaction_type, quantity, price_per_unit,
                fees, taxes, currency, transaction_date,
                is_dividend_reinvestment, asset_account_id, source_account_id,
                linked_recurring_id, note, is_active, created_on, modified_on
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(
            request.portfolioAssetId,
            request.transactionType,
            request.quantity,
            request.pricePerUnit,
            request.fees ?? 0,
            request.taxes ?? 0,
            request.currency ?? 'INR',
            request.transactionDate.toISOString().split('T')[0],
            request.isDividendReinvestment ? 1 : 0,
            request.assetAccountId,
            request.sourceAccountId ?? null,
            request.linkedRecurringId ?? null,
            request.note ?? null,
            now,
            now
        );

        const row = this.db.prepare(`
            SELECT * FROM portfolio_transactions WHERE id = ?
        `).get(result.lastInsertRowid as number) as any;

        return this.mapRow(row);
    }

    deactivate(id: number): void {
        const now = new Date().toISOString();
        this.db.prepare(`
            UPDATE portfolio_transactions SET is_active = 0, modified_on = ? WHERE id = ?
        `).run(now, id);
    }

    listByAsset(portfolioAssetId: number): PortfolioTransaction[] {
        const rows = this.db.prepare(`
            SELECT * FROM portfolio_transactions
            WHERE portfolio_asset_id = ? AND is_active = 1
            ORDER BY transaction_date DESC
        `).all(portfolioAssetId) as any[];

        return rows.map((r) => this.mapRow(r));
    }

    listAll(): PortfolioTransaction[] {
        const rows = this.db.prepare(`
            SELECT * FROM portfolio_transactions WHERE is_active = 1 ORDER BY transaction_date DESC
        `).all() as any[];

        return rows.map((r) => this.mapRow(r));
    }

    getHoldings(): PortfolioHoldingRow[] {
        const rows = this.db.prepare(`SELECT * FROM portfolio_holdings`).all() as any[];
        return rows.map((r) => this.mapHoldingRow(r));
    }

    getSummary(): PortfolioSummaryRow[] {
        const rows = this.db.prepare(`SELECT * FROM portfolio_summary`).all() as any[];
        return rows.map((r) => this.mapSummaryRow(r));
    }

    getValueByAccount(accountId: number): number {
        const row = this.db.prepare(`
            SELECT COALESCE(SUM(h.total_units * a.current_price), 0) AS total_value
            FROM (
                SELECT
                    portfolio_asset_id,
                    SUM(
                        CASE
                            WHEN transaction_type IN ('BUY', 'SIP') THEN quantity
                            WHEN transaction_type = 'DIVIDEND' AND is_dividend_reinvestment = 1 THEN quantity
                            WHEN transaction_type IN ('SELL', 'REDEMPTION') THEN -quantity
                            ELSE 0
                        END
                    ) AS total_units
                FROM portfolio_transactions
                WHERE is_active = 1
                  AND asset_account_id = ?
                GROUP BY portfolio_asset_id
                HAVING total_units > 0
            ) h
            JOIN portfolio_assets a ON a.id = h.portfolio_asset_id
            WHERE a.is_active = 1
        `).get(accountId) as { total_value: number } | undefined;

        return row?.total_value ?? 0;
    }

    getTotalUnitsHeld(portfolioAssetId: number): number {
        const row = this.db.prepare(`
            SELECT COALESCE(total_units, 0) AS total_units
            FROM portfolio_holdings
            WHERE portfolio_asset_id = ?
        `).get(portfolioAssetId) as any;

        return row ? (row.total_units as number) : 0;
    }

    private mapRow(row: any): PortfolioTransaction {
        return {
            id: row.id,
            portfolioAssetId: row.portfolio_asset_id,
            transactionType: row.transaction_type,
            quantity: row.quantity,
            pricePerUnit: row.price_per_unit,
            fees: row.fees,
            taxes: row.taxes,
            currency: row.currency,
            transactionDate: row.transaction_date,
            isDividendReinvestment: row.is_dividend_reinvestment === 1,
            assetAccountId: row.asset_account_id,
            sourceAccountId: row.source_account_id ?? null,
            linkedRecurringId: row.linked_recurring_id ?? null,
            note: row.note ?? null,
            isActive: row.is_active === 1,
            createdOn: row.created_on,
            modifiedOn: row.modified_on,
        };
    }

    private mapHoldingRow(row: any): PortfolioHoldingRow {
        return {
            portfolioAssetId: row.portfolio_asset_id,
            totalUnits: row.total_units,
            totalUnitsAcquired: row.total_units_acquired,
            totalAcquisitionCost: row.total_acquisition_cost,
            totalSaleProceeds: row.total_sale_proceeds,
            totalUnitsSold: row.total_units_sold,
        };
    }

    private mapSummaryRow(row: any): PortfolioSummaryRow {
        return {
            assetId: row.asset_id,
            name: row.name,
            category: row.category,
            type: row.type,
            currentPrice: row.current_price ?? null,
            currency: row.currency,
            lastPriceUpdatedAt: row.last_price_updated_at ?? null,
            portfolioAssetId: row.portfolio_asset_id ?? row.asset_id,
            totalUnits: row.total_units,
            totalUnitsAcquired: row.total_units_acquired,
            totalAcquisitionCost: row.total_acquisition_cost,
            totalSaleProceeds: row.total_sale_proceeds,
            totalUnitsSold: row.total_units_sold ?? 0,
            avco: row.avco,
            costBasis: row.cost_basis,
            currentValue: row.current_value ?? null,
            unrealizedPl: row.unrealized_pl ?? null,
            realizedPl: row.realized_pl ?? 0,
        };
    }
}
