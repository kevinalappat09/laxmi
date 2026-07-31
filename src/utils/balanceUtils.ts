/**
 * @module balanceUtils
 * @description Computes account balances including both legs of transfer transactions.
 * @stability stable
 */

import type { Transaction } from "../types/transaction";
import { TransactionType } from "../types/transaction";

/**
 * Computes the signed balance for an account from transactions that affect it.
 * Deposits add, withdrawals subtract, outgoing transfers subtract, incoming transfers add.
 * Pass transactions that affect the account (e.g. from findAffectingAccount).
 */
export function computeAccountBalance(
    transactions: Transaction[],
    accountId: number
): number {
    return transactions.reduce((sum, tx) => {
        if (tx.transaction_type === TransactionType.Transfer) {
            if (tx.account_id === accountId) return sum - tx.amount;
            if (tx.transfer_account_id === accountId) return sum + tx.amount;
            return sum;
        }

        if (tx.account_id !== accountId) return sum;

        if (tx.transaction_type === TransactionType.Deposit) return sum + tx.amount;
        if (tx.transaction_type === TransactionType.Withdraw) return sum - tx.amount;
        return sum;
    }, 0);
}
