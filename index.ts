import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { initDB } from "./db";
import walletRoutes from "./src/routes/wallet.routes";
import { errorHandler as errorMiddleware } from "./src/middleware/error.middleware";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({success: true, message: "Hello, World!" });
});

app.use("/wallet",walletRoutes);

app.use(errorMiddleware);

const startServer = async () => {
    try {
        await initDB();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }catch (error:any) {
        console.error("Error starting server:", error);
    }
}
startServer();