import express, {Request, Response} from 'express';
import pool from '../../db';
import { RowDataPacket } from 'mysql2/typings/mysql/lib/protocol/packets/RowDataPacket';
import { ResultSetHeader } from 'mysql2/typings/mysql/lib/protocol/packets/ResultSetHeader';


export const createWallet = async (req: Request, res: Response) => {
    try{
        const { userId, currency='INR' } = req.body as {
            userId?: string;
            currency?: string;
        };

        if(!userId) {
            return res.status(400).json({success:false, message: "userId is required" });
        }
        const [users]:any = await pool.query<RowDataPacket[]>("SELECT * FROM users WHERE id = ?", [userId]);
        if(users.length === 0) {
            return res.status(404).json({success:false, message: "User not found" });
        }

        const [existingWallets]:any = await pool.query<RowDataPacket[]>("SELECT * FROM wallets WHERE user_id = ?", [userId]);
        if(existingWallets.length > 0) {
            return res.status(400).json({success:false, message: "Wallet already exists for this user" });
        }

        const result:any = await pool.execute<ResultSetHeader>(`INSERT INTO wallets (user_id, balance, currency, status) VALUES (?, 0.00, ?, "ACTIVE")`, [userId, currency]);

        return res.status(201).json({success:true, message: "Wallet created successfully", wallet: {id: result[0].insertId, userId, balance: 0, currency, status: "ACTIVE" } });
    } catch (error) {
        console.error("Error creating wallet:", error);
        return res.status(500).json({success:false, message: "Internal server error" });
    }
}

export const depositMoney = async (req: Request, res: Response) => {
    const connection: any = await (pool as any).getConnection();
    try{
        const { userId, amount, referenceId, description } = req.body as {
            userId?: number;
            amount?: number;
            referenceId?: string;
            description?: string;
        };

        if(!userId || !amount || !referenceId) {
            return res.status(400).json({success:false, message: "userId, amount and referenceId are required" });
        }

        if(Number(amount) <= 0) {
            return res.status(400).json({success:false, message: "Amount must be greater than 0" });
        }

        await connection.beginTransaction();
        
        const [wallets] = await connection.execute(`SELECT * FROM wallets WHERE user_id = ? FOR UPDATE`, [userId]);

        if(wallets.length === 0) {
            await connection.rollback();
            return res.status(404).json({success:false, message: "Wallet not found for this user" });
        }

        const wallet = wallets[0];
        if(wallet.status !== "ACTIVE") {
            await connection.rollback();
            return res.status(400).json({success:false, message: "Wallet is not active" });
        }

        const [existingTransactions] = await connection.execute(`SELECT * FROM transactions WHERE wallet_id = ? AND reference_id = ?`, [wallet.id, referenceId]);
        if(existingTransactions.length > 0) {
            await connection.rollback();
            return res.status(400).json({success:false, message: "Transaction with this referenceId already exists" });
        }

        const balanceBefore = Number(wallet.balance);
        const balanceAfter = balanceBefore + Number(amount);

        await connection.execute(`UPDATE wallets SET balance = ? WHERE id = ?`, [balanceAfter, wallet.id]);

        const [transactionResult] = await connection.execute(`INSERT INTO transactions (wallet_id, type, amount, reference_id, description, balance_before, balance_after) VALUES (?, "CREDIT", ?, ?, ?, ?, ?)`, [wallet.id, amount, referenceId, description || null, balanceBefore, balanceAfter]);

        await connection.commit();

        return res.status(200).json({success:true, 
            message: "Deposit successful", 
            transaction: {
                id: transactionResult.insertId, 
                walletId: wallet.id, 
                type: "CREDIT", 
                amount: Number(amount),
                referenceId, 
                description, 
                balanceBefore, 
                balanceAfter 
            } });
    } catch (error) {
        await connection.rollback();
        console.error("Error during deposit:", error);
        return res.status(500).json({success:false, message: "Internal server error" });
    }finally {
        connection.release();
    }
}

export const transferMoney = async (req: Request, res: Response) => {
    const connection: any = await (pool as any).getConnection();
    try{
        const { fromUserId, toUserId, amount, referenceId, description } = req.body as {
            fromUserId?: number;
            toUserId?: number;
            amount?: number;
            referenceId?: string;
            description?: string;
        };

        if(!fromUserId || !toUserId || !amount || !referenceId) {
            return res.status(400).json({success:false, message: "fromUserId, toUserId, amount and referenceId are required" });
        }

        if(Number(amount) <= 0) {
            return res.status(400).json({success:false, message: "Amount must be greater than 0" });
        }
        if(Number(fromUserId) === Number(toUserId)) {
            return res.status(400).json({success:false, message: "fromUserId and toUserId cannot be the same" });
        }

        await connection.beginTransaction();
        const firstUserId = Math.min(Number(fromUserId), Number(toUserId));

        const secondUserId = Math.max(Number(fromUserId), Number(toUserId));

        const [wallets] = await connection.execute(`SELECT * FROM wallets WHERE user_id IN (?, ?) ORDER BY user_id FOR UPDATE`, [firstUserId, secondUserId]);
        
        if(wallets.length !== 2) {
            await connection.rollback();
            return res.status(404).json({success:false, message: "One or both wallets not found" });
        }

        const senderWallet = wallets.find((wallet: any) => Number(wallet.user_id) === Number(fromUserId));

        const receiverWallet = wallets.find((wallet: any) => Number(wallet.user_id) === Number(toUserId));
        if(!senderWallet || !receiverWallet) {
            await connection.rollback();
            return res.status(404).json({success:false, message: "One or both wallets not found" });
        }

        if(senderWallet.status !== "ACTIVE" || receiverWallet.status !== "ACTIVE") {
            await connection.rollback();
            return res.status(400).json({success:false, message: "One or both wallets are not active" });
        }

        if(receiverWallet.status !== "ACTIVE") {
            await connection.rollback();
            return res.status(400).json({success:false, message: "Receiver's wallet is not active" });
        }

        const [existingTransactions] = await connection.execute(`SELECT * FROM transactions WHERE reference_id = ? LIMIT 1`, [referenceId]);
        if(existingTransactions.length > 0) {
            await connection.rollback();
            return res.status(400).json({success:false, message: "Transaction with this reference ID already exists" });
        }

        const senderBalanceBefore = Number(senderWallet.balance);
        const receiverBalanceBefore = Number(receiverWallet.balance);
        const transferAmount = Number(amount);

        if(senderBalanceBefore < transferAmount) {
            await connection.rollback();
            return res.status(400).json({success:false, message: "Insufficient balance in sender's wallet" });
        }

        const senderBalanceAfter = senderBalanceBefore - transferAmount;
        const receiverBalanceAfter = receiverBalanceBefore + transferAmount;

        await connection.execute(`UPDATE wallets SET balance = ? WHERE id = ? AND balance >= ?`, [senderBalanceAfter, senderWallet.id, transferAmount]);
        await connection.execute(`UPDATE wallets SET balance = ? WHERE id = ?`, [receiverBalanceAfter, receiverWallet.id]);

        const debitReference = `${referenceId}-DEBIT`;
        await connection.execute(`INSERT INTO transactions (wallet_id, type, amount, reference_id, description, balance_before, balance_after) VALUES (?, "DEBIT", ?, ?, ?, ?, ?)`, [senderWallet.id, transferAmount, debitReference, description || null, senderBalanceBefore, senderBalanceAfter]);
        const creditReference = `${referenceId}-CREDIT`;
        await connection.execute(`INSERT INTO transactions (wallet_id, type, amount, reference_id, description, balance_before, balance_after) VALUES (?, "CREDIT", ?, ?, ?, ?, ?)`, [receiverWallet.id, transferAmount, creditReference, description || null, receiverBalanceBefore, receiverBalanceAfter]);

        await connection.commit();

        return res.status(200).json({success:true,
            message: "Transfer successful",
            transaction: {
                referenceId,
                amount: transferAmount,
                sender: {
                    userId: fromUserId,
                    balanceBefore: senderBalanceBefore,
                    balanceAfter: senderBalanceAfter,
                    walletId: senderWallet.id,
                    transactionType: "DEBIT",
                },

                receiver: {
                    userId: toUserId,
                    balanceBefore: receiverBalanceBefore,  
                    balanceAfter: receiverBalanceAfter,
                    walletId: receiverWallet.id,
                    transactionType: "CREDIT",
                }
            }
        });
    }catch (error) {
        await connection.rollback();
        console.error("Error during transfer:", error);
        return res.status(500).json({success:false, message: "Internal server error" });
    }finally {
        connection.release();
    }
}

export const getBalance = async (req: Request, res: Response) => {
    try{
        const { userId } = req.params as { userId?: string };
        if(!userId) {
            return res.status(400).json({success:false, message: "User ID is required" });
        }
        const [wallets]: any = await pool.execute<RowDataPacket[]>(`SELECT id, user_id, balance, currency, status, created_at FROM wallets WHERE user_id = ?`, [userId]);
        if(wallets.length === 0) {
            return res.status(404).json({success:false, message: "Wallet not found" });
        }
        return res.status(200).json({success:true, wallet: wallets[0] });
    }catch (error) {
        console.error("Error fetching balance:", error);
        return res.status(500).json({success:false, message: "Internal server error" });
    }
}

export const getTransaction = async (req: Request, res: Response) => {
    try{
        const userId = Number(req.params.userId);

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const type = typeof req.query.type === 'string' ? req.query.type : undefined;

        const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
        const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;

        if(!userId) {
            return res.status(400).json({success:false, message: "User ID is required" });
        }
        const [wallets]: any = await pool.execute<RowDataPacket[]>(`SELECT id FROM wallets WHERE user_id = ?`, [userId]);
        if(wallets.length === 0) {
            return res.status(404).json({success:false, message: "Wallet not found" });
        }
        const walletId = wallets[0].id;
        let where = "WHERE wallet_id = ?";
        const params: any[] = [walletId];

        if(type) {
            where += " AND type = ?";
            params.push(type);
        }
        if(fromDate) {
            where += " AND created_at >= ?";
            params.push(fromDate);
        }
        if(toDate) {
            where += " AND created_at <= ?";
            params.push(toDate);
        }

        const [transactions]: any = await pool.execute<RowDataPacket[]>(`SELECT 
            id, type, amount, wallet_id, reference_id, description, balance_before, balance_after, created_at FROM transactions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        
            const [totalCountResult]: any = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as totalCount FROM transactions ${where}`, params);
            const totalCount = Number(totalCountResult[0].totalCount);

            return res.status(200).json({success:true, pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) }, transactions });
    }catch (error) {
        console.error("Error fetching transaction:", error);
        return res.status(500).json({success:false, message: "Internal server error" });
    }
}

export const getSummary = async (req: Request, res: Response) => {
    try{
        const userId = Number(req.params.userId);
        if(!userId) {
            return res.status(400).json({success:false, message: "User ID is required" });
        }

        const [wallets]: any = await pool.execute<RowDataPacket[]>(`SELECT id, balance, currency, status FROM wallets WHERE user_id = ?`, [userId]);
        if(wallets.length === 0) {
            return res.status(404).json({success:false, message: "Wallet not found" });
        }

        const wallet = wallets[0];

        const [summary]: any = await pool.execute<RowDataPacket[]>(`SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) AS totalCredit,
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) AS totalDebit,
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) AS totalTransfer
        FROM transactions WHERE wallet_id = ?`, [wallet.id]);

        return res.status(200).json({success:true, 
            summary: { 
              currentBalance: Number(wallet.balance),
              currency: wallet.currency,
              totalCredit: Number(summary[0].totalCredit),
              totalDebit: Number(summary[0].totalDebit),
              totalTransfer: Number(summary[0].totalTransfer)
            } });
    }catch (error) {
        console.error("Error fetching summary:", error);
        return res.status(500).json({success:false, message: "Internal server error" });
    }    

}

// for testing purpose only
export const createUser = async (req: Request, res: Response) => {
    try{
        const { name, email } = req.body as {
            name?: string;
            email?: string;
        };
        if(!name || !email) {
            return res.status(400).json({success:false, message: "Name and email are required" });
        }
        const [existingUsers]: any = await pool.execute<RowDataPacket[]>(`SELECT * FROM users WHERE email = ?`, [email]);
        if(existingUsers.length > 0) {
            return res.status(400).json({success:false, message: "User with this email already exists" });
        }
        const [newUser]: any = await pool.execute<RowDataPacket[]>(`INSERT INTO users (name, email) VALUES (?, ?)`, [name, email]);

        return res.status(201).json({success:true, message: "User created successfully", user: {id: newUser.insertId, name, email } });
    }
    catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({success:false, message: "Internal server error" });
    }
}