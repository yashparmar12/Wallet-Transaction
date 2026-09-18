import { Router } from "express";

import {createWallet, depositMoney, transferMoney, getBalance, getTransaction, getSummary, createUser} from "../controllers/wallet.controller";

const router = Router();

router.post("/", createWallet);
router.post("/deposit", depositMoney);
router.post("/transfer", transferMoney);
router.get("/balance/:userId", getBalance);
router.get("/transactions/:userId", getTransaction);
router.get("/summary/:userId", getSummary);

//test route for creating a user
router.post("/create-user", createUser);

export default router;