/**
 * @module portfolioTransactionService
 * @description Orchestrates portfolio transaction business logic, including atomic bank account debits/credits.
 * @stability experimental
 */

import {
    CreatePortfolioTransactionRequest,
    PortfolioTransaction,
} from "../../types/portfolioTransaction";
import { PortfolioAssetRepositoryImpl } from "../../repository/portfolioAsset/portfolioAssetRepository";
import { PortfolioTransactionRepositoryImpl } from "../../repository/portfolioTransaction/portfolioTransactionRepository";
import { AccountRepositoryImpl } from "../../repository/account/accountRepository";
import { TransactionRepositoryImpl } from "../../repository/transaction/transactionRepository";
import { profileSessionService } from "../profileSession/profileSessionService";
import { AccountSubType } from "../../types/account";

export interface PortfolioTransactionService {
    create(request: CreatePortfolioTransactionRequest): PortfolioTransaction;
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
                    const txn = {
                        account_id: request.sourceAccountId!,
                        transaction_date: request.transactionDate,
                        transaction_type: laxmiTxn.type as any,
                        amount: laxmiTxn.amount,
                        classification: 'needs' as any,
                        note: request.note ?? undefined,
                        is_active: true,
                        created_on: now,
                        modified_on: now,
                    };
                    transactionRepo.save(txn);
                }
            });

            atomicOp();
            return portfolioTxn;
        }

        // 6. sourceAccountId is null — insert portfolio transaction only
        const txnRepo = new PortfolioTransactionRepositoryImpl(db);
        return txnRepo.create(resolvedRequest);
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
}
