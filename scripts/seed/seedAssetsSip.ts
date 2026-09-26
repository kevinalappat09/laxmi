/**
 * @module seedAssetsSip
 * @description Seeds AssetsSipDemo with steady income, mutual funds, and simulated SIPs.
 * @stability internal
 */

import {
    AccountSubType,
    AccountType,
} from "../../src/types/account";
import {
    Classification,
    TransactionType,
} from "../../src/types/transaction";
import { RecurringFrequency } from "../../src/types/recurringTransaction";
import {
    BulkTransactionRow,
    PROFILE_NAMES,
    SeedServices,
    addMonths,
    bulkInsertTransactions,
    createServices,
    recreateAndOpenProfile,
    requireCategoryId,
    toISODate,
} from "./seedUtils";

const OPENED_ON = new Date("2024-01-01");
const MONTHLY_SALARY = 200000;
/** Simulate SIP installments for this many past months (inclusive of start). */
const SIP_MONTHS = 4;

interface FundSeed {
    name: string;
    schemeCode: string;
    category: "EQUITY" | "DEBT";
    type: "EQUITY_MUTUAL_FUND" | "LIQUID_FUND";
    subCategory:
        | "flexi_cap"
        | "large_cap"
        | "hybrid"
        | "liquid"
        | "index";
    sipAmount: number;
}

/** Scheme codes verified against https://api.mfapi.in/mf/search + /latest. */
const FUNDS: FundSeed[] = [
    {
        name: "Parag Parikh Flexi Cap Fund - Direct Growth",
        schemeCode: "122639",
        category: "EQUITY",
        type: "EQUITY_MUTUAL_FUND",
        subCategory: "flexi_cap",
        sipAmount: 15000,
    },
    {
        name: "HDFC Balanced Advantage Fund - Direct Growth",
        schemeCode: "118968",
        category: "EQUITY",
        type: "EQUITY_MUTUAL_FUND",
        subCategory: "hybrid",
        sipAmount: 10000,
    },
    {
        name: "ICICI Prudential Large Cap Fund - Direct Growth",
        schemeCode: "120586",
        category: "EQUITY",
        type: "EQUITY_MUTUAL_FUND",
        subCategory: "large_cap",
        sipAmount: 10000,
    },
    {
        name: "Mirae Asset Large Cap Fund - Direct Growth",
        schemeCode: "118825",
        category: "EQUITY",
        type: "EQUITY_MUTUAL_FUND",
        subCategory: "large_cap",
        sipAmount: 8000,
    },
    {
        name: "UTI Nifty 50 Index Fund - Direct Growth",
        schemeCode: "120716",
        category: "EQUITY",
        type: "EQUITY_MUTUAL_FUND",
        subCategory: "index",
        sipAmount: 7000,
    },
    {
        name: "HDFC Liquid Fund - Direct Growth",
        schemeCode: "119091",
        category: "DEBT",
        type: "LIQUID_FUND",
        subCategory: "liquid",
        sipAmount: 5000,
    },
];

async function verifyScheme(schemeCode: string): Promise<{ name: string; nav: number }> {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    if (!res.ok) {
        throw new Error(`MFAPI ${schemeCode}: HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
        meta?: { scheme_name?: string };
        data?: Array<{ nav: string }>;
        status?: string;
    };
    const nav = json.data?.[0] ? parseFloat(json.data[0].nav) : NaN;
    if (!Number.isFinite(nav)) {
        throw new Error(`MFAPI ${schemeCode}: empty NAV`);
    }
    return {
        name: json.meta?.scheme_name ?? `Scheme ${schemeCode}`,
        nav,
    };
}

function seedSalaryHistory(
    salaryAccountId: number,
    cat: Map<string, number>,
    from: Date,
    to: Date
): BulkTransactionRow[] {
    const rows: BulkTransactionRow[] = [];
    rows.push({
        account_id: salaryAccountId,
        transaction_date: toISODate(from),
        transaction_type: TransactionType.Deposit,
        amount: 500000,
        category_id: requireCategoryId(cat, "Other Income"),
        classification: Classification.Needs,
        payee: "Opening Balance",
        note: "Seed opening balance",
        transfer_account_id: null,
    });

    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
        rows.push({
            account_id: salaryAccountId,
            transaction_date: toISODate(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
            transaction_type: TransactionType.Deposit,
            amount: MONTHLY_SALARY,
            category_id: requireCategoryId(cat, "Salary"),
            classification: Classification.Needs,
            payee: "SteadyCorp India",
            note: "Monthly salary ~2L",
            transfer_account_id: null,
        });
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return rows;
}

export async function seedAssetsSipProfile(
    services: SeedServices = createServices()
): Promise<void> {
    const db = await recreateAndOpenProfile(
        PROFILE_NAMES.assetsSip,
        services.migrationService
    );

    const salary = services.accounts.createAccount({
        institution_name: "HDFC Bank",
        account_name: "Salary Account",
        account_type: AccountType.Asset,
        sub_type: AccountSubType.Salary,
        color: "#27AE60",
        opened_on: OPENED_ON,
    });

    const investment = services.accounts.createAccount({
        institution_name: "Zerodha",
        account_name: "Zerodha Coin",
        account_type: AccountType.Asset,
        sub_type: AccountSubType.Investment,
        color: "#E67E22",
        opened_on: OPENED_ON,
        metadata: { broker: "zerodha" },
    });

    console.log(
        `  Accounts: ${salary.account_name} (#${salary.account_id}), ${investment.account_name} (#${investment.account_id})`
    );

    const cat = services.categories.getCategoryNameMap();
    const today = new Date();
    const salaryRows = seedSalaryHistory(salary.account_id, cat, OPENED_ON, today);
    bulkInsertTransactions(db, salaryRows);
    console.log(`  Salary deposits: ${salaryRows.length} (₹${MONTHLY_SALARY}/mo)`);

    console.log("  Verifying mutual fund NAVs via MFAPI…");
    const sipStart = addMonths(new Date(today.getFullYear(), today.getMonth(), 5), -(SIP_MONTHS - 1));

    for (const fund of FUNDS) {
        const live = await verifyScheme(fund.schemeCode);
        console.log(
            `    ${fund.schemeCode} → ${live.name} | NAV ₹${live.nav.toFixed(4)}`
        );
        if (!live.name.toLowerCase().includes(fund.name.split(" ")[0]!.toLowerCase())) {
            console.warn(
                `    WARNING: seeded label "${fund.name}" may not match MFAPI name`
            );
        }

        const asset = services.portfolioAssets.create({
            name: live.name,
            category: fund.category,
            type: fund.type,
            subCategory: fund.subCategory,
            priceSource: "MFAPI",
            priceSourceId: fund.schemeCode,
            currency: "INR",
            metadata: { schemeCode: fund.schemeCode },
        });

        services.recurring.createRecurringTransaction({
            account_id: salary.account_id,
            transaction_type: TransactionType.Withdraw,
            amount: fund.sipAmount,
            category_id: requireCategoryId(cat, "Investing"),
            classification: Classification.Needs,
            payee: fund.name,
            note: `Monthly SIP ₹${fund.sipAmount}`,
            frequency: RecurringFrequency.Monthly,
            day_of_month: 5,
            start_date: sipStart,
            portfolio_asset_id: asset.id,
            asset_account_id: investment.account_id,
        });
    }

    // Materialize past SIP months by processing as of tomorrow (cutoff = today - 1 day logic uses -1 from ref)
    // processRecurringTransactions cutoff = referenceDate - 1 day, so use day after last intended due date.
    const processAsOf = new Date(today.getFullYear(), today.getMonth(), 6);
    console.log(`  Processing SIPs as of ${toISODate(processAsOf)}…`);
    const created = await services.recurring.processRecurringTransactions(processAsOf);
    console.log(`  SIP portfolio transactions materialized: ${created}`);

    console.log("  Refreshing latest prices…");
    const priceResult = await services.prices.refreshAll();
    console.log(
        `  Prices refreshed: ${priceResult.refreshedCount}, failed: ${priceResult.failedAssets.length}`
    );
    if (priceResult.failedAssets.length > 0) {
        for (const f of priceResult.failedAssets) {
            console.warn(`    Price fail: ${f.name} — ${f.error}`);
        }
    }

    const assets = services.portfolioAssets.listActive();
    console.log(`  Active portfolio assets: ${assets.length}`);
    for (const a of assets) {
        console.log(
            `    #${a.id} ${a.name} | price=${a.currentPrice ?? "n/a"} | source=${a.priceSourceId}`
        );
    }
}
