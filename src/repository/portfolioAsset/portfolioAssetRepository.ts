/**
 * @module portfolioAssetRepository
 * @description Provides direct database access for PortfolioAsset entities.
 * @stability experimental
 */

import { SQLiteDatabase } from "../../database/databaseService";
import {
    CreatePortfolioAssetRequest,
    PortfolioAsset,
    PriceSource,
    UpdatePortfolioAssetRequest,
} from "../../types/portfolioAsset";

export interface PortfolioAssetRepository {
    create(request: CreatePortfolioAssetRequest): PortfolioAsset;
    update(id: number, request: UpdatePortfolioAssetRequest): PortfolioAsset;
    deactivate(id: number): void;
    getById(id: number): PortfolioAsset | null;
    listActive(): PortfolioAsset[];
    listByPriceSource(source: PriceSource): PortfolioAsset[];
    updatePrice(id: number, price: number, updatedAt: string): void;
}

export class PortfolioAssetRepositoryImpl implements PortfolioAssetRepository {
    constructor(private db: SQLiteDatabase) {}

    create(request: CreatePortfolioAssetRequest): PortfolioAsset {
        const now = new Date().toISOString();
        const result = this.db.prepare(`
            INSERT INTO portfolio_assets (
                name, category, type, sub_category,
                price_source, price_source_id,
                current_price, last_price_updated_at,
                currency, metadata, is_active, created_on, modified_on
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 1, ?, ?)
        `).run(
            request.name,
            request.category,
            request.type,
            request.subCategory ?? null,
            request.priceSource,
            request.priceSourceId,
            request.currency ?? 'INR',
            request.metadata != null ? JSON.stringify(request.metadata) : null,
            now,
            now
        );

        return this.getById(result.lastInsertRowid as number)!;
    }

    update(id: number, request: UpdatePortfolioAssetRequest): PortfolioAsset {
        const existing = this.getById(id);
        if (!existing) {
            throw new Error(`PortfolioAsset not found: ${id}`);
        }

        const now = new Date().toISOString();

        const name        = request.name        !== undefined ? request.name        : existing.name;
        const subCategory = request.subCategory !== undefined ? request.subCategory : existing.subCategory;
        const priceSource = request.priceSource !== undefined ? request.priceSource : existing.priceSource;
        const priceSourceId = request.priceSourceId !== undefined ? request.priceSourceId : existing.priceSourceId;
        const isActive    = request.isActive    !== undefined ? request.isActive    : existing.isActive;
        const metadata    = request.metadata    !== undefined
            ? JSON.stringify(request.metadata)
            : (existing.metadata != null ? JSON.stringify(existing.metadata) : null);

        this.db.prepare(`
            UPDATE portfolio_assets
            SET name = ?, sub_category = ?, price_source = ?, price_source_id = ?,
                metadata = ?, is_active = ?, modified_on = ?
            WHERE id = ?
        `).run(name, subCategory, priceSource, priceSourceId, metadata, isActive ? 1 : 0, now, id);

        return this.getById(id)!;
    }

    deactivate(id: number): void {
        const now = new Date().toISOString();
        this.db.prepare(`
            UPDATE portfolio_assets SET is_active = 0, modified_on = ? WHERE id = ?
        `).run(now, id);
    }

    getById(id: number): PortfolioAsset | null {
        const row = this.db.prepare(`
            SELECT * FROM portfolio_assets WHERE id = ?
        `).get(id) as any;

        return row ? this.mapRow(row) : null;
    }

    listActive(): PortfolioAsset[] {
        const rows = this.db.prepare(`
            SELECT * FROM portfolio_assets WHERE is_active = 1 ORDER BY id
        `).all() as any[];

        return rows.map((r) => this.mapRow(r));
    }

    listByPriceSource(source: PriceSource): PortfolioAsset[] {
        const rows = this.db.prepare(`
            SELECT * FROM portfolio_assets WHERE price_source = ? AND is_active = 1 ORDER BY id
        `).all(source) as any[];

        return rows.map((r) => this.mapRow(r));
    }

    updatePrice(id: number, price: number, updatedAt: string): void {
        const now = new Date().toISOString();
        this.db.prepare(`
            UPDATE portfolio_assets
            SET current_price = ?, last_price_updated_at = ?, modified_on = ?
            WHERE id = ?
        `).run(price, updatedAt, now, id);
    }

    private mapRow(row: any): PortfolioAsset {
        return {
            id: row.id,
            name: row.name,
            category: row.category,
            type: row.type,
            subCategory: row.sub_category ?? null,
            priceSource: row.price_source ?? null,
            priceSourceId: row.price_source_id ?? null,
            currentPrice: row.current_price ?? null,
            lastPriceUpdatedAt: row.last_price_updated_at ?? null,
            currency: row.currency,
            metadata: row.metadata != null ? JSON.parse(row.metadata) : null,
            isActive: row.is_active === 1,
            createdOn: row.created_on,
            modifiedOn: row.modified_on,
        };
    }
}
