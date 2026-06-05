/**
 * @module mfapiSearchService
 * @description Searches mutual funds by name using the MFAPI public API.
 * @stability experimental
 */

import { MfSearchResult } from "../../types/portfolioAnalytics";
import { AssetCategory, AssetSubCategory } from "../../types/portfolioAsset";
import { MfFundMeta } from "../../types/portfolioAnalytics";

export interface MfapiSearchService {
    search(query: string): Promise<MfSearchResult[]>;
    getMeta(schemeCode: string): Promise<MfFundMeta>;
}

export class MfapiSearchServiceImpl implements MfapiSearchService {
    async search(query: string): Promise<MfSearchResult[]> {
        const res = await fetch(
            `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) throw new Error(`MFAPI search failed: ${res.status}`);
        const json = await res.json() as { schemeCode: number; schemeName: string }[];
        return json.map((item) => ({
            schemeCode: String(item.schemeCode),
            schemeName: item.schemeName,
        }));
    }

    async getMeta(schemeCode: string): Promise<MfFundMeta> {
        const res = await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}/latest`);
        if (!res.ok) throw new Error(`MFAPI meta fetch failed: ${res.status}`);
        const json = await res.json() as { meta?: { scheme_type?: string; scheme_category?: string } };
        const schemeType = json.meta?.scheme_type ?? "";
        const schemeCategory = json.meta?.scheme_category ?? "";

        return {
            category: this.parseCategory(schemeType),
            subCategory: this.parseSubCategory(schemeCategory),
            schemeType,
            schemeCategory,
        };
    }

    private parseCategory(schemeType: string): AssetCategory {
        const normalized = schemeType.toLowerCase();
        if (normalized.includes("(debt)")) return "DEBT";
        if (normalized.includes("(equity)")) return "EQUITY";
        return "EQUITY";
    }

    private parseSubCategory(schemeCategory: string): AssetSubCategory | null {
        const normalized = schemeCategory.toLowerCase();

        if (normalized.includes("international") || normalized.includes("overseas") || normalized.includes("global")) return "international";
        if (normalized.includes("liquid") || normalized.includes("money market")) return "liquid";
        if (normalized.includes("large cap") || normalized.includes("largecap")) return "large_cap";
        if (normalized.includes("mid cap") || normalized.includes("midcap")) return "mid_cap";
        if (normalized.includes("small cap") || normalized.includes("smallcap")) return "small_cap";
        if (normalized.includes("flexi cap") || normalized.includes("flexicap") || normalized.includes("multi cap") || normalized.includes("multicap")) return "flexi_cap";
        if (normalized.includes("index") || normalized.includes("etf")) return "index";
        if (normalized.includes("elss") || normalized.includes("tax saver")) return "elss";
        if (normalized.includes("hybrid") || normalized.includes("balanced")) return "hybrid";
        if (normalized.includes("debt") || normalized.includes("corporate bond") || normalized.includes("gilt") || normalized.includes("short duration") || normalized.includes("medium duration")) return "debt";

        return null;
    }
}
