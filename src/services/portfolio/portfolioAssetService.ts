/**
 * @module portfolioAssetService
 * @description Orchestrates portfolio asset business logic and persistence.
 * @stability experimental
 */

import {
    CreatePortfolioAssetRequest,
    PortfolioAsset,
    UpdatePortfolioAssetRequest,
} from "../../types/portfolioAsset";
import { PortfolioAssetRepositoryImpl } from "../../repository/portfolioAsset/portfolioAssetRepository";
import { profileSessionService } from "../profileSession/profileSessionService";

export interface PortfolioAssetService {
    create(request: CreatePortfolioAssetRequest): PortfolioAsset;
    update(id: number, request: UpdatePortfolioAssetRequest): PortfolioAsset;
    deactivate(id: number): void;
    getById(id: number): PortfolioAsset;
    listActive(): PortfolioAsset[];
}

export class PortfolioAssetServiceImpl implements PortfolioAssetService {
    create(request: CreatePortfolioAssetRequest): PortfolioAsset {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        this.validateRequest(request);

        const repo = new PortfolioAssetRepositoryImpl(db);
        return repo.create(request);
    }

    update(id: number, request: UpdatePortfolioAssetRequest): PortfolioAsset {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        const repo = new PortfolioAssetRepositoryImpl(db);
        return repo.update(id, request);
    }

    deactivate(id: number): void {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        const repo = new PortfolioAssetRepositoryImpl(db);
        const asset = repo.getById(id);
        if (!asset) throw new Error(`Asset not found: ${id}`);

        repo.deactivate(id);
    }

    getById(id: number): PortfolioAsset {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        const repo = new PortfolioAssetRepositoryImpl(db);
        const asset = repo.getById(id);
        if (!asset) throw new Error(`Asset not found: ${id}`);

        return asset;
    }

    listActive(): PortfolioAsset[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        const repo = new PortfolioAssetRepositoryImpl(db);
        return repo.listActive();
    }

    private validateRequest(request: CreatePortfolioAssetRequest): void {
        const { type, priceSource, metadata } = request;

        if (type === 'EQUITY_MUTUAL_FUND' || type === 'LIQUID_FUND') {
            if (priceSource !== 'MFAPI') {
                throw new Error("Invalid price source for mutual fund: must be MFAPI");
            }
            if (!metadata || !metadata.schemeCode) {
                throw new Error("Missing MFAPI scheme code: metadata.schemeCode is required");
            }
        }

        if (type === 'STOCK' || type === 'ETF') {
            if (priceSource !== 'YAHOO') {
                throw new Error("Invalid price source for stock/ETF: must be YAHOO");
            }
            if (!metadata || !metadata.ticker) {
                throw new Error("Missing or invalid Yahoo ticker: metadata.ticker is required");
            }
            const ticker = metadata.ticker as string;
            if (!ticker.endsWith('.NS') && !ticker.endsWith('.BO')) {
                throw new Error("Missing or invalid Yahoo ticker: must end in .NS or .BO");
            }
        }
    }
}
