import { SQLiteDatabase } from "../database/databaseService";

export function up(db: SQLiteDatabase): void {
    db.exec(`
        CREATE TABLE portfolio_transactions (
            id                        INTEGER PRIMARY KEY AUTOINCREMENT,
            portfolio_asset_id        INTEGER NOT NULL,
            transaction_type          TEXT NOT NULL,
            quantity                  REAL NOT NULL CHECK(quantity >= 0),
            price_per_unit            REAL NOT NULL CHECK(price_per_unit > 0),
            fees                      REAL NOT NULL DEFAULT 0,
            taxes                     REAL NOT NULL DEFAULT 0,
            currency                  TEXT NOT NULL DEFAULT 'INR',
            transaction_date          TEXT NOT NULL,
            is_dividend_reinvestment  INTEGER NOT NULL DEFAULT 0,
            asset_account_id          INTEGER NOT NULL,
            source_account_id         INTEGER,
            linked_recurring_id       INTEGER,
            note                      TEXT,
            is_active                 INTEGER NOT NULL DEFAULT 1,
            created_on                TEXT NOT NULL,
            modified_on               TEXT NOT NULL,
            FOREIGN KEY(portfolio_asset_id) REFERENCES portfolio_assets(id),
            FOREIGN KEY(asset_account_id)   REFERENCES accounts(account_id),
            FOREIGN KEY(source_account_id)  REFERENCES accounts(account_id)
        );

        CREATE INDEX idx_ptxn_asset  ON portfolio_transactions(portfolio_asset_id);
        CREATE INDEX idx_ptxn_date   ON portfolio_transactions(transaction_date);
        CREATE INDEX idx_ptxn_active ON portfolio_transactions(is_active);

        CREATE VIEW portfolio_holdings AS
        SELECT
            portfolio_asset_id,
            SUM(
                CASE
                    WHEN transaction_type IN ('BUY', 'SIP')                                    THEN  quantity
                    WHEN transaction_type = 'DIVIDEND' AND is_dividend_reinvestment = 1        THEN  quantity
                    WHEN transaction_type IN ('SELL', 'REDEMPTION')                            THEN -quantity
                    ELSE 0
                END
            ) AS total_units,
            SUM(
                CASE
                    WHEN transaction_type IN ('BUY', 'SIP')                             THEN  quantity
                    WHEN transaction_type = 'DIVIDEND' AND is_dividend_reinvestment = 1 THEN  quantity
                    ELSE 0
                END
            ) AS total_units_acquired,
            SUM(
                CASE
                    WHEN transaction_type IN ('BUY', 'SIP')                             THEN (quantity * price_per_unit) + fees + taxes
                    WHEN transaction_type = 'DIVIDEND' AND is_dividend_reinvestment = 1 THEN  quantity * price_per_unit
                    ELSE 0
                END
            ) AS total_acquisition_cost,
            SUM(
                CASE
                    WHEN transaction_type IN ('SELL', 'REDEMPTION') THEN (quantity * price_per_unit) - fees - taxes
                    ELSE 0
                END
            ) AS total_sale_proceeds,
            SUM(
                CASE
                    WHEN transaction_type IN ('SELL', 'REDEMPTION') THEN quantity
                    ELSE 0
                END
            ) AS total_units_sold
        FROM portfolio_transactions
        WHERE is_active = 1
        GROUP BY portfolio_asset_id;

        CREATE VIEW portfolio_summary AS
        SELECT
            a.id                   AS asset_id,
            a.name,
            a.category,
            a.type,
            a.current_price,
            a.currency,
            a.last_price_updated_at,
            h.total_units,
            h.total_units_acquired,
            h.total_acquisition_cost,
            h.total_sale_proceeds,
            CASE
                WHEN h.total_units_acquired > 0
                THEN h.total_acquisition_cost / h.total_units_acquired
                ELSE 0
            END AS avco,
            CASE
                WHEN h.total_units_acquired > 0
                THEN (h.total_acquisition_cost / h.total_units_acquired) * h.total_units
                ELSE 0
            END AS cost_basis,
            h.total_units * a.current_price AS current_value,
            (h.total_units * a.current_price)
                - ((h.total_acquisition_cost / NULLIF(h.total_units_acquired, 0)) * h.total_units)
                AS unrealized_pl,
            h.total_sale_proceeds
                - ((h.total_acquisition_cost / NULLIF(h.total_units_acquired, 0)) * h.total_units_sold)
                AS realized_pl
        FROM portfolio_assets a
        JOIN portfolio_holdings h ON a.id = h.portfolio_asset_id
        WHERE a.is_active = 1
          AND h.total_units > 0;
    `);
}
