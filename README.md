# Wallet Transaction & Transfer API

A backend REST API built with **Node.js, Express.js, TypeScript, and MySQL

##  Tech Stack

* Node.js
* Express.js
* TypeScript
* MySQL
* mysql2
* Express Validator
* dotenv
* CORS
##  Installation

Clone the repository:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
```

Install dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=wallet_db
DB_PORT=3306
```

##  Database Setup

Make sure MySQL is running.

The application initializes the required database and tables.

Required tables:

* `users`
* `wallets`
* `wallet_transactions`

You can also execute:

```text
database/schema.sql
```

manually in MySQL.



## Run the Project

Development:

```bash
npm run dev
```

The server will run on:

```text
http://localhost:5000
```

## API Endpoints

### 1. Create User

```http
POST /users
```

Request:

```json
{
  "name": "Yash",
  "email": "yash@gmail.com"
}
```

---

### 2. Create Wallet

```http
POST /wallet
```

Request:

```json
{
  "userId": 1,
  "currency": "INR"
}
```

---

### 3. Add Money

```http
POST /wallet/deposit
```

Request:

```json
{
  "userId": 1,
  "amount": 10000,
  "referenceId": "DEP001",
  "description": "Initial deposit"
}
```

---

### 4. Transfer Money

```http
POST /wallet/transfer
```

Request:

```json
{
  "fromUserId": 1,
  "toUserId": 2,
  "amount": 2500,
  "referenceId": "TXN001",
  "description": "Wallet transfer"
}
```

The transfer performs:

```text
Sender Balance    = Sender Balance - Amount
Receiver Balance  = Receiver Balance + Amount
```

Both balance updates and transaction records are handled atomically.

---

### 5. Get Wallet Balance

```http
GET /wallet/balance/1
```

Returns the current wallet balance.

---

### 6. Transaction History

```http
GET /wallet/transactions/1&page=1&limit=10
```

Supported filters:

```text
type
fromDate
toDate
page
limit
```

Example:

```http
GET /wallet/transactions/1&type=DEBIT&page=1&limit=10
```

---

### 7. Wallet Summary

```http
GET /wallet/summary/1
```

Returns:

* Current balance
* Total credited amount
* Total debited amount
* Total transferred amount
The APIs can be tested using:

* Postman
* Thunder Client


Recommended testing flow:

```text
1. Create User
2. Create another User
3. Create Wallet for both users
4. Deposit money into User 1
5. Transfer money from User 1 to User 2
6. Check both balances
7. Check transaction history
8. Check wallet summary
9. Test insufficient balance
10. Test duplicate referenceId
```

## 📌 Example Transfer

Before transfer:

```text
User 1: ₹10,000
User 2: ₹5,000
```

Transfer:

```text
₹2,500
```

After transfer:

```text
User 1: ₹7,500
User 2: ₹7,500
```

Transactions created:

```text
User 1 → DEBIT  ₹2,500
User 2 → CREDIT ₹2,500
```
