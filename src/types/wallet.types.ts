export type WalletStatus = "ACTIVE" | "INACTIVE";

export type TransactionType = "CREDIT" | "DEBIT" | "TRANSFER";

export interface CreateWalletBody {
    userId: string;
    currency?: string;
}

export interface DepositBody {
    userId: number;
    amount: number;
    referenceId: string;
    description?: string;
}

export interface TransferBody {
    fromUserId: number;
    toUserId: number;
    amount: number;
    referenceId: string;
    description?: string;
}
