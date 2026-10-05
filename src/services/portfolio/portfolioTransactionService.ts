/**
 * @module portfolioTransactionService
 * @description Orchestrates portfolio transaction business logic, including atomic bank account debits/credits.
 * @stability experimental
 */

import {
    CreatePortfolioTransactionRequest,
    PortfolioTransaction,
    PortfolioTransactionType,
    UpdatePortfolioTransactionRequest,
} from "../../types/portfolioTransaction";
import { PortfolioAssetRepositoryImpl } from "../../repository/portfolioAsset/portfolioAssetRepository";
import { PortfolioTransactionRepositoryImpl } from "../../repository/portfolioTransaction/portfolioTransactionRepository";
import { AccountRepositoryImpl } from "../../repository/account/accountRepository";
import { TransactionRepositoryImpl } from "../../repository/transaction/transactionRepository";
import { SQLiteDatabase } from "../../database/databaseService";
import { profileSessionService } from "../profileSession/profileSessionService";
import { AccountSubType } from "../../types/account";
import { Classification, TransactionType } from "../../types/transaction";

export interface PortfolioTransactionService {
    create(request: CreatePortfolioTransactionRequest): PortfolioTransaction;
    update(id: number, request: UpdatePortfolioTransactionRequest): PortfolioTransaction;
    deactivate(id: number): void;
    listByAsset(portfolioAssetId: number): PortfolioTransaction[];
    listAll(): PortfolioTransaction[];
}

export class PortfolioTransactionServiceImpl implements PortfolioTransactionService {
    create(request: CreatePortfolioTransactionRequest): PortfolioTransaction {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        // 1. Validate asset exists and is active
        const assetRepo = new PortfolioAssetRepositoryImpl(db);
        const asset = assetRepo.getById(request.portfolioAssetId);
        if (!asset) throw new Error(`Portfolio asset not found: ${request.portfolioAssetId}`);
        if (!asset.isActive) throw new Error(`Portfolio asset is inactive: ${request.portfolioAssetId}`);

        // 2. Resolve quantity
        const quantity = this.resolveQuantity(request);

        // 3. Validate investment account
        const accountRepo = new AccountRepositoryImpl(db);
        const assetAccount = accountRepo.findById(request.assetAccountId);
        if (!assetAccount || !assetAccount.is_active) {
            throw new Error(`Investment account not found or inactive: ${request.assetAccountId}`);
        }
        if (assetAccount.sub_type !== AccountSubType.Investment) {
            throw new Error(`Account ${request.assetAccountId} is not an investment account`);
        }

        // 4. Oversell guard for SELL / REDEMPTION
        if (request.transactionType === 'SELL' || request.transactionType === 'REDEMPTION') {
            const txnRepo = new PortfolioTransactionRepositoryImpl(db);
            const held = txnRepo.getTotalUnitsHeld(request.portfolioAssetId);
            if (quantity > held) {
                throw new Error(
                    `Cannot sell more units than currently held (held: ${held}, requested: ${quantity})`
                );
            }
        }

        const resolvedRequest = { ...request, quantity };

        // 5. If sourceAccountId is set: validate + atomic insert
        if (request.sourceAccountId != null) {
            const sourceAccount = accountRepo.findById(request.sourceAccountId);
            if (!sourceAccount || !sourceAccount.is_active) {
                throw new Error(`Source account not found or inactive: ${request.sourceAccountId}`);
            }

            const txnRepo = new PortfolioTransactionRepositoryImpl(db);
            const transactionRepo = new TransactionRepositoryImpl(db);
            const now = new Date();

            let portfolioTxn!: PortfolioTransaction;

            const atomicOp = db.transaction(() => {
                portfolioTxn = txnRepo.create(resolvedRequest);

                const laxmiTxn = this.buildLaxmiTransaction(request, quantity, now);
                if (laxmiTxn) {
                    const saved = transactionRepo.save({
                        account_id: request.sourceAccountId!,
                        transaction_date: request.transactionDate,
                        transaction_type: laxmiTxn.type === "withdraw" ? TransactionType.Withdraw : TransactionType.Deposit,
                        amount: laxmiTxn.amount,
                        classification: laxmiTxn.type === "deposit"
                            ? Classification.Income
                            : Classification.Needs,
                        note: request.note ?? undefined,
                        is_active: true,
                        created_on: now,
                        modified_on: now,
                    });
                    txnRepo.setLinkedTransactionId(portfolioTxn.id, saved.transaction_id!);
                    portfolioTxn = txnRepo.getById(portfolioTxn.id)!;
                }
            });

            atomicOp();
            return portfolioTxn;
        }

        // 6. sourceAccountId is null — insert portfolio transaction only
        const txnRepo = new PortfolioTransactionRepositoryImpl(db);
        return txnRepo.create(resolvedRequest);
    }

    update(id: number, request: UpdatePortfolioTransactionRequest): PortfolioTransaction {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        const txnRepo = new PortfolioTransactionRepositoryImpl(db);
        const existing = txnRepo.getById(id);
        if (!existing || !existing.isActive) throw new Error(`Portfolio transaction not found: ${id}`);

        const assetRepo = new PortfolioAssetRepositoryImpl(db);
        const asset = assetRepo.getById(existing.portfolioAssetId);
        if (!asset || !asset.isActive) throw new Error(`Portfolio asset is inactive: ${existing.portfolioAssetId}`);

        const quantity = this.resolveQuantity({
            ...request,
            portfolioAssetId: existing.portfolioAssetId,
        });

        const accountRepo = new AccountRepositoryImpl(db);
        const assetAccount = accountRepo.findById(request.assetAccountId);
        if (!assetAccount || !assetAccount.is_active) {
            throw new Error(`Investment account not found or inactive: ${request.assetAccountId}`);
        }
        if (assetAccount.sub_type !== AccountSubType.Investment) {
            throw new Error(`Account ${request.assetAccountId} is not an investment account`);
        }

        if (request.sourceAccountId != null) {
            const sourceAccount = accountRepo.findById(request.sourceAccountId);
            if (!sourceAccount || !sourceAccount.is_active) {
                throw new Error(`Source account not found or inactive: ${request.sourceAccountId}`);
            }
        }

        const reinvest = request.isDividendReinvestment ?? false;
        const held = txnRepo.getTotalUnitsHeld(existing.portfolioAssetId);
        const projected =
            held
            - this.unitsContribution(existing.transactionType, existing.quantity, existing.isDividendReinvestment)
            + this.unitsContribution(request.transactionType, quantity, reinvest);
        if (projected < -1e-6) {
            throw new Error(
                `Cannot sell more units than currently held (held: ${Math.max(held, 0)}, requested: ${quantity})`
            );
        }

        const transactionRepo = new TransactionRepositoryImpl(db);
        const atomicOp = db.transaction(() => {
            const updated = txnRepo.update(id, {
                transactionType: request.transactionType,
                quantity,
                pricePerUnit: request.pricePerUnit,
                fees: request.fees ?? 0,
                taxes: request.taxes ?? existing.taxes,
                currency: request.currency ?? existing.currency,
                transactionDate: request.transactionDate,
                isDividendReinvestment: reinvest,
                assetAccountId: request.assetAccountId,
                sourceAccountId: request.sourceAccountId ?? null,
                note: request.note?.trim() ? request.note.trim() : null,
            });
            this.syncLinkedAccountTransaction(db, existing, updated, transactionRepo, txnRepo);
            return txnRepo.getById(id)!;
        });

        return atomicOp();
    }

    deactivate(id: number): void {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        const repo = new PortfolioTransactionRepositoryImpl(db);
        repo.deactivate(id);
    }

    listByAsset(portfolioAssetId: number): PortfolioTransaction[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        const repo = new PortfolioTransactionRepositoryImpl(db);
        return repo.listByAsset(portfolioAssetId);
    }

    listAll(): PortfolioTransaction[] {
        const db = profileSessionService.getDatabaseConnection();
        if (!db) throw new Error("No active database connection. Open a profile first.");

        const repo = new PortfolioTransactionRepositoryImpl(db);
        return repo.listAll();
    }

    private resolveQuantity(request: CreatePortfolioTransactionRequest): number {
        const hasQty = request.quantity !== undefined;
        const hasAmt = request.investedAmount !== undefined;

        if (hasQty && hasAmt) {
            throw new Error("Provide either quantity or investedAmount, not both");
        }
        if (!hasQty && !hasAmt) {
            throw new Error("Either quantity or investedAmount must be provided");
        }

        if (hasAmt) {
            return request.investedAmount! / request.pricePerUnit;
        }
        return request.quantity!;
    }

    private buildLaxmiTransaction(
        request: CreatePortfolioTransactionRequest,
        quantity: number,
        now: Date
    ): { type: 'withdraw' | 'deposit'; amount: number } | null {
        const fees = request.fees ?? 0;
        const taxes = request.taxes ?? 0;
        const { transactionType, isDividendReinvestment, pricePerUnit } = request;

        if (transactionType === 'BUY' || transactionType === 'SIP') {
            return { type: 'withdraw', amount: quantity * pricePerUnit + fees + taxes };
        }
        if (transactionType === 'SELL' || transactionType === 'REDEMPTION') {
            return { type: 'deposit', amount: quantity * pricePerUnit - fees - taxes };
        }
        if (transactionType === 'DIVIDEND') {
            if (isDividendReinvestment) return null;
            return { type: 'deposit', amount: quantity * pricePerUnit };
        }
        return null;
    }

    private unitsContribution(type: PortfolioTransactionType, quantity: number, reinvest: boolean): number {
        if (type === "BUY" || type === "SIP") return quantity;
        if (type === "DIVIDEND" && reinvest) return quantity;
        if (type === "SELL" || type === "REDEMPTION") return -quantity;
        return 0;
    }

    private cashMovement(txn: PortfolioTransaction): { type: "withdraw" | "deposit"; amount: number } | null {
        return this.buildLaxmiTransaction(
            {
                portfolioAssetId: txn.portfolioAssetId,
                transactionType: txn.transactionType,
                pricePerUnit: txn.pricePerUnit,
                fees: txn.fees,
                taxes: txn.taxes,
                isDividendReinvestment: txn.isDividendReinvestment,
                transactionDate: new Date(txn.transactionDate),
                assetAccountId: txn.assetAccountId,
            },
            txn.quantity,
            new Date()
        );
    }

    private findLegacyLinkedTransactionId(db: SQLiteDatabase, existing: PortfolioTransaction): number | null {
        const movement = this.cashMovement(existing);
        if (!movement || existing.sourceAccountId == null) return null;

        const rows = db.prepare(`
            SELECT transaction_id FROM transactions
            WHERE is_active = 1
              AND account_id = ?
              AND transaction_type = ?
              AND transaction_date = ?
              AND ABS(amount - ?) < 0.05
              AND transaction_id NOT IN (
                SELECT linked_transaction_id FROM portfolio_transactions
                WHERE linked_transaction_id IS NOT NULL AND id != ?
              )
        `).all(
            existing.sourceAccountId,
            movement.type,
            existing.transactionDate.slice(0, 10),
            movement.amount,
            existing.id
        ) as { transaction_id: number }[];

        return rows.length === 1 ? rows[0].transaction_id : null;
    }

    private syncLinkedAccountTransaction(
        db: SQLiteDatabase,
        existing: PortfolioTransaction,
        updated: PortfolioTransaction,
        transactionRepo: TransactionRepositoryImpl,
        txnRepo: PortfolioTransactionRepositoryImpl
    ): void {
        const desired = updated.sourceAccountId != null ? this.cashMovement(updated) : null;
        let linkedId = existing.linkedTransactionId;
        if (linkedId && !transactionRepo.findById(linkedId)) linkedId = null;
        if (!linkedId) linkedId = this.findLegacyLinkedTransactionId(db, existing);

        const now = new Date();
        if (desired && linkedId) {
            const current = transactionRepo.findById(linkedId);
            if (!current) throw new Error("Linked account transaction not found");
            transactionRepo.save({
                ...current,
                account_id: updated.sourceAccountId!,
                transaction_date: new Date(updated.transactionDate),
                transaction_type: desired.type === "withdraw" ? TransactionType.Withdraw : TransactionType.Deposit,
                amount: desired.amount,
                classification: desired.type === "deposit"
                    ? Classification.Income
                    : current.classification === Classification.Income
                        ? Classification.Needs
                        : current.classification,
                note: updated.note !== existing.note ? (updated.note ?? undefined) : current.note,
                modified_on: now,
            });
            txnRepo.setLinkedTransactionId(updated.id, linkedId);
            return;
        }

        if (desired) {
            if (existing.sourceAccountId != null && this.cashMovement(existing)) {
                throw new Error("Couldn't match the account transaction for this entry. Delete it and log it again.");
            }
            const saved = transactionRepo.save({
                account_id: updated.sourceAccountId!,
                transaction_date: new Date(updated.transactionDate),
                transaction_type: desired.type === "withdraw" ? TransactionType.Withdraw : TransactionType.Deposit,
                amount: desired.amount,
                classification: desired.type === "deposit"
                    ? Classification.Income
                    : Classification.Needs,
                note: updated.note ?? undefined,
                is_active: true,
                created_on: now,
                modified_on: now,
            });
            txnRepo.setLinkedTransactionId(updated.id, saved.transaction_id!);
            return;
        }

        if (linkedId) {
            transactionRepo.delete(linkedId);
            txnRepo.setLinkedTransactionId(updated.id, null);
            return;
        }

        if (existing.sourceAccountId != null && this.cashMovement(existing)) {
            throw new Error("Couldn't match the account transaction for this entry. Delete it and log it again.");
        }
    }
}
