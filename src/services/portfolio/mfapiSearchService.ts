/**
 * @module mfapiSearchService
 * @description Searches mutual funds by name using the MFAPI public API.
 * @stability experimental
 */

import { MfSearchResult } from "../../types/portfolioAnalytics";

export interface MfapiSearchService {
    search(query: string): Promise<MfSearchResult[]>;
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
}
