import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
});

export const initDB = async () => {
    try {
        await pool.query('SELECT 1');
        console.log("Database connection established successfully.");

        const sqlPath = path.resolve('schema.sql');
        const sqlScript = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sqlScript);
        console.log("Database schema initialized successfully.");
    }catch (error:any) {
        console.error("Error initializing database:", error);
    }
}

export default pool;