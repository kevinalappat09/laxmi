import { computeAccountBalance } from "./balanceUtils";
import { Transaction, TransactionType, Classification } from "../types/transaction";

function tx(partial: Partial<Transaction>): Transaction {
    return {
        account_id: 1,
        transaction_date: new Date("2024-01-01"),
        transaction_type: TransactionType.Withdraw,
        amount: 0,
        classification: Classification.Needs,
        is_active: true,
        created_on: new Date(),
        modified_on: new Date(),
        ...partial,
    };
}

describe("computeAccountBalance", () => {
    test("adds deposits and subtracts withdrawals for the account", () => {
        const txns = [
            tx({ account_id: 1, transaction_type: TransactionType.Deposit, amount: 100 }),
            tx({ account_id: 1, transaction_type: TransactionType.Withdraw, amount: 30 }),
        ];
        expect(computeAccountBalance(txns, 1)).toBe(70);
    });

    test("treats outgoing transfers as a subtraction from the source", () => {
        const txns = [
            tx({
                account_id: 1,
                transaction_type: TransactionType.Transfer,
                transfer_account_id: 2,
                amount: 40,
            }),
        ];
        expect(computeAccountBalance(txns, 1)).toBe(-40);
    });

    test("treats incoming transfers as an addition to the destination", () => {
        const txns = [
            tx({
                account_id: 1,
                transaction_type: TransactionType.Transfer,
                transfer_account_id: 2,
                amount: 40,
            }),
        ];
        expect(computeAccountBalance(txns, 2)).toBe(40);
    });

    test("credit card charge then payment reduces what is owed", () => {
        const cardId = 5;
        const txns = [
            tx({ account_id: cardId, transaction_type: TransactionType.Withdraw, amount: 200 }),
            tx({
                account_id: 9,
                transaction_type: TransactionType.Transfer,
                transfer_account_id: cardId,
                amount: 50,
            }),
        ];
        expect(computeAccountBalance(txns, cardId)).toBe(-150);
    });

    test("ignores transactions that do not affect the account", () => {
        const txns = [
            tx({ account_id: 2, transaction_type: TransactionType.Deposit, amount: 100 }),
        ];
        expect(computeAccountBalance(txns, 1)).toBe(0);
    });
});
