import { SQLiteDatabase } from "../database/databaseService";

interface CategorySeedNode {
    name: string;
    children?: string[];
}

const CATEGORY_TREE: CategorySeedNode[] = [
    {
        name: "Income",
        children: [
            "Salary",
            "Business Income",
            "Bonuses",
            "Investment Income",
            "Rental Income",
            "Refunds",
            "Other Income",
        ],
    },
    {
        name: "Housing",
        children: [
            "Rent",
            "Property Tax",
            "Maintenance Repairs",
            "Home Insurance",
        ],
    },
    {
        name: "Bills",
        children: [
            "Electricity",
            "Water",
            "Gas",
            "Internet",
            "Mobile Phone",
            "Subscriptions",
        ],
    },
    {
        name: "Transportation",
        children: [
            "Petrol",
            "EMI",
            "Maintenance",
            "Parking",
            "Toll",
            "Bus",
            "Cab",
            "Auto",
            "Bike",
            "Flight",
            "Train",
        ],
    },
    {
        name: "Food",
        children: ["Groceries", "Dining Out"],
    },
    {
        name: "Insurance",
        children: ["Health", "Life", "Vehicle", "Home", "Other"],
    },
    {
        name: "Healthcare",
        children: ["Doctor visit", "Medicine", "Tests", "Fitness"],
    },
    {
        name: "Credit",
        children: ["Credit Card Payments", "Loan Payments"],
    },
    {
        name: "Education",
        children: ["Books", "Courses", "Tuition"],
    },
    {
        name: "Homeneeds",
        children: ["Clothing", "Furniture", "Supplies"],
    },
    { name: "Investing" },
    { name: "Leisure" },
    {
        name: "Vacation",
        children: ["Lodging", "Travel", "Sightseeing"],
    },
    { name: "Gifts" },
    { name: "Other Expenses" },
];

export function up(db: SQLiteDatabase): void {
    const now = new Date().toISOString();

    const insertRoot = db.prepare(`
        INSERT OR IGNORE INTO categories (
            category_name,
            parent_category_id,
            is_active,
            created_on,
            modified_on
        ) VALUES (?, NULL, 1, ?, ?)
    `);

    const insertChild = db.prepare(`
        INSERT OR IGNORE INTO categories (
            category_name,
            parent_category_id,
            is_active,
            created_on,
            modified_on
        )
        SELECT ?, parent.category_id, 1, ?, ?
        FROM categories parent
        WHERE parent.category_name = ?
    `);

    for (const root of CATEGORY_TREE) {
        insertRoot.run(root.name, now, now);
    }

    for (const root of CATEGORY_TREE) {
        for (const child of root.children ?? []) {
            insertChild.run(child, now, now, root.name);
        }
    }
}
