/**
 * @module seedCreditCard
 * @description Seeds CreditCardDemo with steady income, two cards, and utilization/due scenarios.
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
import {
    BulkTransactionRow,
    PROFILE_NAMES,
    SeedServices,
    addDays,
    bulkInsertTransactions,
    createRng,
    createServices,
    pick,
    randomAmount,
    recreateAndOpenProfile,
    requireCategoryId,
    toISODate,
} from "./seedUtils";

const OPENED_ON = new Date("2025-01-01");
const MONTHLY_SALARY = 150000;

/** Low-limit card target outstanding (~94% of ₹50k). */
const LOW_LIMIT = 50000;
const LOW_TARGET_OUTSTANDING = 47000;

/** High-limit card target outstanding (~42% of ₹5L). */
const HIGH_LIMIT = 500000;
const HIGH_TARGET_OUTSTANDING = 210000;

const MERCHANTS: Array<{
    category: string;
    payees: string[];
    classification: Classification;
    min: number;
    max: number;
}> = [
    { category: "Dining Out", payees: ["Swiggy", "Zomato", "Starbucks", "Absolut Barbecue"], classification: Classification.Wants, min: 400, max: 4500 },
    { category: "Groceries", payees: ["BigBasket", "Blinkit", "Zepto"], classification: Classification.Needs, min: 300, max: 3500 },
    { category: "Subscriptions", payees: ["Amazon Prime", "Netflix", "Hotstar"], classification: Classification.Wants, min: 149, max: 1499 },
    { category: "Flight", payees: ["MakeMyTrip", "Cleartrip", "IndiGo"], classification: Classification.Wants, min: 4000, max: 22000 },
    { category: "Lodging", payees: ["Booking.com", "Airbnb", "Taj Hotels"], classification: Classification.Wants, min: 3000, max: 18000 },
    { category: "Clothing", payees: ["Myntra", "Nykaa Fashion", "H&M"], classification: Classification.Wants, min: 800, max: 6000 },
    { category: "Petrol", payees: ["Indian Oil", "Shell"], classification: Classification.Needs, min: 500, max: 3000 },
    { category: "Medicine", payees: ["Apollo 24/7", "PharmEasy"], classification: Classification.Needs, min: 200, max: 2500 },
    { category: "Leisure", payees: ["BookMyShow", "District by Zomato"], classification: Classification.Wants, min: 300, max: 2000 },
    { category: "Other Expenses", payees: ["Amazon", "Flipkart", "Apple Store"], classification: Classification.Unnecessary, min: 500, max: 12000 },
];

function seedIncome(
    checkingId: number,
    cat: Map<string, number>,
    from: Date,
    to: Date
): BulkTransactionRow[] {
    const rows: BulkTransactionRow[] = [];
    rows.push({
        account_id: checkingId,
        transaction_date: toISODate(from),
        transaction_type: TransactionType.Deposit,
        amount: 300000,
        category_id: requireCategoryId(cat, "Other Income"),
        classification: Classification.Income,
        payee: "Opening Balance",
        note: "Seed opening balance",
        transfer_account_id: null,
    });

    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
        rows.push({
            account_id: checkingId,
            transaction_date: toISODate(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
            transaction_type: TransactionType.Deposit,
            amount: MONTHLY_SALARY,
            category_id: requireCategoryId(cat, "Salary"),
            classification: Classification.Income,
            payee: "PayCorp Ltd",
            note: "Monthly salary",
            transfer_account_id: null,
        });
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return rows;
}

/**
 * Builds charge volume with settled historical cycles, then leaves a controlled outstanding.
 */
function buildCardActivity(options: {
    cardId: number;
    checkingId: number;
    cat: Map<string, number>;
    from: Date;
    to: Date;
    chargeCount: number;
    targetOutstanding: number;
    rng: () => number;
}): BulkTransactionRow[] {
    const { cardId, checkingId, cat, from, to, chargeCount, targetOutstanding, rng } = options;
    const rows: BulkTransactionRow[] = [];
    const spanMs = Math.max(1, to.getTime() - from.getTime());

    // Historical charges (will be mostly paid off)
    let historicalTotal = 0;
    const historicalCount = Math.max(0, chargeCount - 8);
    for (let i = 0; i < historicalCount; i++) {
        const merchant = pick(rng, MERCHANTS);
        const offset = Math.floor(rng() * spanMs * 0.85);
        const date = addDays(from, Math.floor(offset / (24 * 60 * 60 * 1000)));
        const amount = randomAmount(rng, merchant.min, merchant.max);
        historicalTotal += amount;
        rows.push({
            account_id: cardId,
            transaction_date: toISODate(date),
            transaction_type: TransactionType.Withdraw,
            amount,
            category_id: requireCategoryId(cat, merchant.category),
            classification: merchant.classification,
            payee: pick(rng, merchant.payees),
            note: null,
            transfer_account_id: null,
        });
    }

    // Pay off almost all historical spend (leave a little slack for rounding)
    const paymentAmount = Math.max(0, Math.round(historicalTotal - targetOutstanding * 0.05));
    if (paymentAmount > 0) {
        rows.push({
            account_id: checkingId,
            transaction_date: toISODate(addDays(to, -20)),
            transaction_type: TransactionType.Transfer,
            amount: paymentAmount,
            category_id: null,
            classification: Classification.Needs,
            payee: null,
            note: "Statement payment",
            transfer_account_id: cardId,
        });
    }

    // Recent unpaid charges sized to land near targetOutstanding
    // After payment, outstanding ≈ historicalTotal - paymentAmount ≈ 0.05 * target
    // So we need ~0.95 * target in fresh charges
    const remaining = Math.max(1000, targetOutstanding - (historicalTotal - paymentAmount));
    const recentCount = Math.max(3, chargeCount - historicalCount);
    const piece = remaining / recentCount;
    for (let i = 0; i < recentCount; i++) {
        const merchant = pick(rng, MERCHANTS);
        const date = addDays(to, -(recentCount - i));
        const amount =
            i === recentCount - 1
                ? Math.round(remaining - piece * (recentCount - 1))
                : Math.round(piece * (0.85 + rng() * 0.3));
        rows.push({
            account_id: cardId,
            transaction_date: toISODate(date),
            transaction_type: TransactionType.Withdraw,
            amount: Math.max(100, amount),
            category_id: requireCategoryId(cat, merchant.category),
            classification: merchant.classification,
            payee: pick(rng, merchant.payees),
            note: "Current cycle charge",
            transfer_account_id: null,
        });
    }

    return rows;
}

export async function seedCreditCardProfile(
    services: SeedServices = createServices()
): Promise<void> {
    const db = await recreateAndOpenProfile(
        PROFILE_NAMES.creditCard,
        services.migrationService
    );

    const checking = services.accounts.createAccount({
        institution_name: "HDFC Bank",
        account_name: "Salary Checking",
        account_type: AccountType.Asset,
        sub_type: AccountSubType.Checking,
        color: "#1ABC9C",
        opened_on: OPENED_ON,
    });

    const lowCard = services.accounts.createAccount({
        institution_name: "HDFC Bank",
        account_name: "Millennia Credit Card",
        account_type: AccountType.Liability,
        sub_type: AccountSubType.Credit,
        color: "#E74C3C",
        opened_on: OPENED_ON,
    });

    const highCard = services.accounts.createAccount({
        institution_name: "Axis Bank",
        account_name: "Magnus Credit Card",
        account_type: AccountType.Liability,
        sub_type: AccountSubType.Credit,
        color: "#9B59B6",
        opened_on: OPENED_ON,
    });

    // Statement/due days chosen so reminders fire near "today" (Aug 5, 2026 era)
    services.creditCards.upsertCreditCardDetails(lowCard.account_id, {
        credit_limit: LOW_LIMIT,
        statement_day: 8,
        payment_due_day: 12,
        utilization_alert_threshold: 0.05,
        statement_reminder_lead_days: 7,
        payment_reminder_lead_days: 10,
    });

    services.creditCards.upsertCreditCardDetails(highCard.account_id, {
        credit_limit: HIGH_LIMIT,
        statement_day: 5,
        payment_due_day: 10,
        utilization_alert_threshold: 0.3,
        statement_reminder_lead_days: 5,
        payment_reminder_lead_days: 7,
    });

    console.log(
        `  Accounts: checking=#${checking.account_id}, lowCard=#${lowCard.account_id} (₹${LOW_LIMIT / 1000}k), highCard=#${highCard.account_id} (₹${HIGH_LIMIT / 100000}L)`
    );

    const cat = services.categories.getCategoryNameMap();
    const today = new Date();
    const rows: BulkTransactionRow[] = [];

    rows.push(...seedIncome(checking.account_id, cat, OPENED_ON, today));

    rows.push(
        ...buildCardActivity({
            cardId: lowCard.account_id,
            checkingId: checking.account_id,
            cat,
            from: OPENED_ON,
            to: today,
            chargeCount: 130,
            targetOutstanding: LOW_TARGET_OUTSTANDING,
            rng: createRng(0xcafd1001),
        })
    );

    rows.push(
        ...buildCardActivity({
            cardId: highCard.account_id,
            checkingId: checking.account_id,
            cat,
            from: OPENED_ON,
            to: today,
            chargeCount: 140,
            targetOutstanding: HIGH_TARGET_OUTSTANDING,
            rng: createRng(0xcafd2002),
        })
    );

    console.log(`  Inserting ${rows.length} transactions…`);
    bulkInsertTransactions(db, rows);

    const summaries = services.creditCards.listCreditCardSummaries(today);
    for (const s of summaries) {
        console.log(
            `  ${s.account.account_name}: outstanding=₹${s.outstanding.toFixed(0)} ` +
                `util=${(s.utilization * 100).toFixed(1)}% ` +
                `due=${toISODate(s.next_due_date)} stmt=${toISODate(s.next_statement_date)}`
        );
    }

    const notifications = services.creditCards.getNotifications(today);
    console.log(
        `  Credit notifications: ${notifications.length} — ${notifications
            .map((n) => n.kind)
            .join(", ") || "none"}`
    );
}
