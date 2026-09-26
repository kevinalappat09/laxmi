/**
 * @module seedTxnBudget
 * @description Seeds TxnBudgetDemo with two checking accounts, multi-year transactions, and breached budgets.
 * @stability internal
 */

import {
    AccountSubType,
    AccountType,
} from "../../src/types/account";
import {
    BudgetPeriod,
    BudgetType,
} from "../../src/types/budget";
import {
    Classification,
    TransactionType,
} from "../../src/types/transaction";
import {
    BulkTransactionRow,
    PROFILE_NAMES,
    SeedServices,
    bulkInsertTransactions,
    createRng,
    createServices,
    daysInMonth,
    pick,
    randomAmount,
    recreateAndOpenProfile,
    requireCategoryId,
    toISODate,
} from "./seedUtils";

const OPENED_ON = new Date("2021-08-01");
const RANGE_START = new Date("2021-08-01");

interface SpendTemplate {
    category: string;
    payees: string[];
    classification: Classification;
    min: number;
    max: number;
    /** Approximate monthly occurrences on this account. */
    monthlyRate: number;
}

/** Primary salary account — Bangalore tech worker lifestyle. */
const PRIMARY_SPEND: SpendTemplate[] = [
    { category: "Rent", payees: ["Landlord - Koramangala"], classification: Classification.Needs, min: 28000, max: 32000, monthlyRate: 1 },
    { category: "Groceries", payees: ["BigBasket", "DMart", "Nature's Basket"], classification: Classification.Needs, min: 800, max: 3500, monthlyRate: 10 },
    { category: "Dining Out", payees: ["Swiggy", "Zomato", "Toit", "Truffles", "Meghana Foods"], classification: Classification.Wants, min: 250, max: 2200, monthlyRate: 16 },
    { category: "Petrol", payees: ["Indian Oil", "HP Petrol"], classification: Classification.Needs, min: 500, max: 2500, monthlyRate: 6 },
    { category: "Cab", payees: ["Uber", "Ola"], classification: Classification.Wants, min: 120, max: 650, monthlyRate: 14 },
    { category: "Internet", payees: ["ACT Fibernet"], classification: Classification.Needs, min: 999, max: 1299, monthlyRate: 1 },
    { category: "Mobile Phone", payees: ["Airtel", "Jio"], classification: Classification.Needs, min: 299, max: 699, monthlyRate: 1 },
    { category: "Subscriptions", payees: ["Netflix", "Spotify", "YouTube Premium", "Cursor"], classification: Classification.Wants, min: 149, max: 799, monthlyRate: 4 },
    { category: "Electricity", payees: ["BESCOM"], classification: Classification.Needs, min: 1200, max: 2800, monthlyRate: 1 },
    { category: "Fitness", payees: ["Cult.fit", "Decathlon"], classification: Classification.Wants, min: 500, max: 2500, monthlyRate: 2 },
    { category: "Medicine", payees: ["Apollo Pharmacy", "1mg"], classification: Classification.Needs, min: 150, max: 1200, monthlyRate: 2 },
    { category: "Leisure", payees: ["PVR Cinemas", "BookMyShow", "Steam"], classification: Classification.Wants, min: 300, max: 2500, monthlyRate: 3 },
    { category: "Clothing", payees: ["Myntra", "Ajio", "Uniqlo"], classification: Classification.Wants, min: 800, max: 4500, monthlyRate: 2 },
    { category: "Flight", payees: ["IndiGo", "Air India"], classification: Classification.Wants, min: 3500, max: 18000, monthlyRate: 0.4 },
    { category: "Bus", payees: ["BMTC", "RedBus"], classification: Classification.Needs, min: 30, max: 400, monthlyRate: 6 },
    { category: "Parking", payees: ["Mall Parking", "Office Parking"], classification: Classification.Needs, min: 40, max: 200, monthlyRate: 8 },
    { category: "Toll", payees: ["Fastag"], classification: Classification.Needs, min: 40, max: 350, monthlyRate: 4 },
];

/** Secondary household account — more domestic, fewer restaurants. */
const SECONDARY_SPEND: SpendTemplate[] = [
    { category: "Groceries", payees: ["More Supermarket", "Reliance Fresh", "Local Kirana"], classification: Classification.Needs, min: 400, max: 2800, monthlyRate: 12 },
    { category: "Dining Out", payees: ["Domino's", "Cafe Coffee Day", "Local Cafe"], classification: Classification.Wants, min: 200, max: 1200, monthlyRate: 6 },
    { category: "Petrol", payees: ["BPCL", "Shell"], classification: Classification.Needs, min: 400, max: 2000, monthlyRate: 4 },
    { category: "Water", payees: ["BWSSB"], classification: Classification.Needs, min: 200, max: 450, monthlyRate: 1 },
    { category: "Gas", payees: ["Indane Gas"], classification: Classification.Needs, min: 900, max: 1200, monthlyRate: 1 },
    { category: "Supplies", payees: ["Amazon", "Flipkart", "Ikea"], classification: Classification.Needs, min: 300, max: 5000, monthlyRate: 4 },
    { category: "Furniture", payees: ["Pepperfry", "Urban Ladder"], classification: Classification.Wants, min: 2000, max: 25000, monthlyRate: 0.25 },
    { category: "Doctor visit", payees: ["Manipal Hospital", "Aster Clinic"], classification: Classification.Needs, min: 500, max: 2500, monthlyRate: 0.8 },
    { category: "Tests", payees: ["Thyrocare", "SRL Diagnostics"], classification: Classification.Needs, min: 800, max: 4500, monthlyRate: 0.5 },
    { category: "Tuition", payees: ["Byju's", "Local Tutor"], classification: Classification.Needs, min: 3000, max: 8000, monthlyRate: 0.6 },
    { category: "Gifts", payees: ["Flower Aura", "Amazon Gift"], classification: Classification.Wants, min: 500, max: 5000, monthlyRate: 1 },
    { category: "Other Expenses", payees: ["ATM Withdrawal", "Misc"], classification: Classification.Unnecessary, min: 200, max: 3000, monthlyRate: 4 },
    { category: "Auto", payees: ["Auto Rickshaw"], classification: Classification.Needs, min: 50, max: 250, monthlyRate: 8 },
    { category: "Books", payees: ["Crossword", "Amazon Books"], classification: Classification.Wants, min: 200, max: 1500, monthlyRate: 1 },
];

function generateMonthSpend(
    accountId: number,
    year: number,
    monthIndex: number,
    templates: SpendTemplate[],
    cat: Map<string, number>,
    rng: () => number,
    boostDining = false
): BulkTransactionRow[] {
    const rows: BulkTransactionRow[] = [];
    const dim = daysInMonth(year, monthIndex);

    for (const tpl of templates) {
        let count = Math.round(tpl.monthlyRate);
        if (tpl.monthlyRate < 1 && rng() > tpl.monthlyRate) {
            continue;
        }
        if (tpl.monthlyRate < 1) {
            count = 1;
        }
        if (boostDining && tpl.category === "Dining Out") {
            count = Math.max(count, 18);
        }

        for (let i = 0; i < count; i++) {
            const day = 1 + Math.floor(rng() * dim);
            const date = new Date(year, monthIndex, day);
            let amount = randomAmount(rng, tpl.min, tpl.max);
            if (boostDining && tpl.category === "Dining Out") {
                amount = randomAmount(rng, 800, 3500);
            }
            rows.push({
                account_id: accountId,
                transaction_date: toISODate(date),
                transaction_type: TransactionType.Withdraw,
                amount,
                category_id: requireCategoryId(cat, tpl.category),
                classification: tpl.classification,
                payee: pick(rng, tpl.payees),
                note: null,
                transfer_account_id: null,
            });
        }
    }

    return rows;
}

function generateTransactions(
    primaryId: number,
    secondaryId: number,
    cat: Map<string, number>,
    rangeEnd: Date
): BulkTransactionRow[] {
    const rngPrimary = createRng(0x7a1b_c0de);
    const rngSecondary = createRng(0x51ed_cafe);
    const rows: BulkTransactionRow[] = [];

    // Opening balances
    rows.push({
        account_id: primaryId,
        transaction_date: toISODate(OPENED_ON),
        transaction_type: TransactionType.Deposit,
        amount: 250000,
        category_id: requireCategoryId(cat, "Other Income"),
        classification: Classification.Needs,
        payee: "Opening Balance",
        note: "Seed opening balance",
        transfer_account_id: null,
    });
    rows.push({
        account_id: secondaryId,
        transaction_date: toISODate(OPENED_ON),
        transaction_type: TransactionType.Deposit,
        amount: 180000,
        category_id: requireCategoryId(cat, "Other Income"),
        classification: Classification.Needs,
        payee: "Opening Balance",
        note: "Seed opening balance",
        transfer_account_id: null,
    });

    const cursor = new Date(RANGE_START);
    while (cursor <= rangeEnd) {
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        const isCurrentMonth =
            y === rangeEnd.getFullYear() && m === rangeEnd.getMonth();

        // Salary on primary — ~1.15L with annual raises
        const yearsFromStart = y - 2021;
        const salary = 95000 + yearsFromStart * 12000 + Math.floor(rngPrimary() * 5000);
        rows.push({
            account_id: primaryId,
            transaction_date: toISODate(new Date(y, m, 1)),
            transaction_type: TransactionType.Deposit,
            amount: salary,
            category_id: requireCategoryId(cat, "Salary"),
            classification: Classification.Needs,
            payee: "Acme Tech Pvt Ltd",
            note: "Monthly salary",
            transfer_account_id: null,
        });

        // Secondary gets a smaller consulting/freelance income mid-month
        if (rngSecondary() > 0.25) {
            rows.push({
                account_id: secondaryId,
                transaction_date: toISODate(new Date(y, m, 15)),
                transaction_type: TransactionType.Deposit,
                amount: randomAmount(rngSecondary, 25000, 55000),
                category_id: requireCategoryId(cat, "Business Income"),
                classification: Classification.Needs,
                payee: "Freelance Client",
                note: "Consulting invoice",
                transfer_account_id: null,
            });
        }

        // Occasional bonus
        if (m === 2 || m === 9) {
            rows.push({
                account_id: primaryId,
                transaction_date: toISODate(new Date(y, m, 28)),
                transaction_type: TransactionType.Deposit,
                amount: randomAmount(rngPrimary, 20000, 80000),
                category_id: requireCategoryId(cat, "Bonuses"),
                classification: Classification.Needs,
                payee: "Acme Tech Pvt Ltd",
                note: "Performance bonus",
                transfer_account_id: null,
            });
        }

        rows.push(
            ...generateMonthSpend(primaryId, y, m, PRIMARY_SPEND, cat, rngPrimary, isCurrentMonth),
            ...generateMonthSpend(secondaryId, y, m, SECONDARY_SPEND, cat, rngSecondary, isCurrentMonth)
        );

        // Occasional transfer primary → secondary (household share)
        if (rngPrimary() > 0.55) {
            const day = 5 + Math.floor(rngPrimary() * 10);
            rows.push({
                account_id: primaryId,
                transaction_date: toISODate(new Date(y, m, Math.min(day, daysInMonth(y, m)))),
                transaction_type: TransactionType.Transfer,
                amount: randomAmount(rngPrimary, 10000, 25000),
                category_id: null,
                classification: Classification.Needs,
                payee: null,
                note: "Household transfer",
                transfer_account_id: secondaryId,
            });
        }

        cursor.setMonth(cursor.getMonth() + 1);
    }

    return rows;
}

export async function seedTxnBudgetProfile(
    services: SeedServices = createServices()
): Promise<void> {
    const db = await recreateAndOpenProfile(
        PROFILE_NAMES.txnBudget,
        services.migrationService
    );

    const primary = services.accounts.createAccount({
        institution_name: "HDFC Bank",
        account_name: "Primary Checking",
        account_type: AccountType.Asset,
        sub_type: AccountSubType.Checking,
        color: "#2ECC71",
        opened_on: OPENED_ON,
    });

    const secondary = services.accounts.createAccount({
        institution_name: "ICICI Bank",
        account_name: "Household Checking",
        account_type: AccountType.Asset,
        sub_type: AccountSubType.Checking,
        color: "#3498DB",
        opened_on: OPENED_ON,
    });

    console.log(
        `  Accounts: ${primary.account_name} (#${primary.account_id}), ${secondary.account_name} (#${secondary.account_id})`
    );

    const cat = services.categories.getCategoryNameMap();
    const rangeEnd = new Date();
    const rows = generateTransactions(
        primary.account_id,
        secondary.account_id,
        cat,
        rangeEnd
    );

    console.log(`  Inserting ${rows.length} transactions…`);
    bulkInsertTransactions(db, rows);

    // Budgets sized to be breached by current-month spend
    services.budgets.createBudget({
        name: "Monthly Overall Cap",
        budget_type: BudgetType.Overall,
        period: BudgetPeriod.Monthly,
        amount: 45000,
        warning_threshold: 0.8,
    });

    services.budgets.createBudget({
        name: "Primary Checking Monthly",
        budget_type: BudgetType.Account,
        period: BudgetPeriod.Monthly,
        amount: 35000,
        account_id: primary.account_id,
        warning_threshold: 0.8,
    });

    services.budgets.createBudget({
        name: "Dining Out Monthly",
        budget_type: BudgetType.Category,
        period: BudgetPeriod.Monthly,
        amount: 8000,
        category_id: requireCategoryId(cat, "Dining Out"),
        warning_threshold: 0.75,
    });

    const notifications = services.budgets.getNotifications(new Date());
    console.log(`  Budgets created: 3`);
    console.log(
        `  Budget alerts (home): ${notifications.length} — ${notifications
            .map((n) => `${n.name} (${n.status}, ${n.percentage}%)`)
            .join("; ") || "none"}`
    );
}
