# VeemahPay Java Transaction Server

A modular Java HTTP server that provides CRUD operations for VeemahPay transactions, designed to replace the Next.js `/api/transactions` endpoints.

## 🚀 Quick Start

### 1. Start the Server

```bash
cd e_java_server
./run-server.sh
```

### 2. Start dev Environment

```bash
npm run dev
```

## 📡 API Endpoints

### Base URL
- **Production**: `https://sasha-nonreliable-thunderingly.ngrok-free.dev`
- **Local**: `http://localhost:8080`

### Transaction CRUD Operations

#### 1. Get Transactions
```http
GET /api/transactions?account={account_number}
```

**Query Parameters:**
- `account` (required): Account number to fetch transactions for
- `type` (optional): Filter by transaction type (deposit, withdraw, transfer)
- `status` (optional): Filter by status 
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)
- `min_amount` (optional): Minimum amount filter
- `max_amount` (optional): Maximum amount filter
- `limit` (optional): Number of results (default: 100, max: 500)

**Response:**
```json
{
  "transactions": [
    {
      "id": 123,
      "type": "transfer",
      "status": "Completed",
      "account_number": "1234567890",
      "target_account": "0987654321",
      "amount": 150.0,
      "fee": 0.0,
      "note": "Payment for services",
      "created_by": "1234567890",
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T10:30:00Z"
    }
  ],
  "next_cursor": null
}
```

#### 2. Get Single Transaction
```http
GET /api/transactions/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "type": "transfer",
    "status": "Completed",
    "account_number": "1234567890",
    "target_account": "0987654321",
    "amount": 150.0,
    "note": "Payment for services"
  }
}
```

#### 3. Create Transaction
```http
POST /api/transactions
Content-Type: application/json

{
  "source_account": "1234567890",
  "target_account": "0987654321",
  "amount": 150.0,
  "type": "transfer",
  "note": "Payment for services",
  "status": "Completed"
}
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "id": 124,
    "type": "transfer",
    "status": "Completed",
    "account_number": "1234567890",
    "target_account": "0987654321",
    "amount": 150.0,
    "note": "Payment for services",
    "created_at": "2024-01-15T11:00:00Z"
  },
  "message": "Transaction created successfully"
}
```

#### 4. Update Transaction
```http
PUT /api/transactions/{id}
Content-Type: application/json

{
  "status": "Cancelled",
  "note": "Updated note"
}
```

#### 5. Cancel Transaction (Soft Delete)
```http
DELETE /api/transactions/{id}
```

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "VeemahPay Transaction API",
  "database": "connected",
  "timestamp": "Mon Jan 15 10:30:00 UTC 2024"
}
```

## 🔧 Integration with Next.js

To replace Next.js API calls with the Java server, update your frontend code:

### Before (Next.js API)
```typescript
const response = await fetch('/api/transactions?account=123');
```

### After (Java Server)
```typescript
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://sasha-nonreliable-thunderingly.ngrok-free.dev'
  : 'http://localhost:8080';

const response = await fetch(`${API_BASE}/api/transactions?account=123`);
```

### Environment Variables

Add to your `.env.local`:

```bash
# Java Transaction Server
JAVA_TRANSACTION_API=https://sasha-nonreliable-thunderingly.ngrok-free.dev
# or for local development
# JAVA_TRANSACTION_API=http://localhost:8080
```

### API Helper Function

Create `lib/java-api.ts`:

```typescript
const JAVA_API_BASE = process.env.JAVA_TRANSACTION_API || 'http://localhost:8080';

export async function fetchTransactions(params: {
  account: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([_, value]) => value !== undefined)
  ).toString();
  
  const response = await fetch(`${JAVA_API_BASE}/api/transactions?${queryString}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function createTransaction(data: {
  source_account: string;
  target_account?: string;
  amount: number;
  type: 'deposit' | 'withdraw' | 'transfer';
  note?: string;
  status?: string;
}) {
  const response = await fetch(`${JAVA_API_BASE}/api/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function updateTransaction(id: string, data: {
  status?: string;
  note?: string;
}) {
  const response = await fetch(`${JAVA_API_BASE}/api/transactions/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function cancelTransaction(id: string) {
  const response = await fetch(`${JAVA_API_BASE}/api/transactions/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
```

## 🛠️ Development

### Manual Compilation
```bash
# Download PostgreSQL driver
wget -O postgresql-42.7.3.jar https://jdbc.postgresql.org/download/postgresql-42.7.3.jar

# Compile
javac -cp ".:postgresql-42.7.3.jar" *.java

# Run
java -cp ".:postgresql-42.7.3.jar" Server
```

### Testing with curl
```bash
# Get transactions
curl "https://sasha-nonreliable-thunderingly.ngrok-free.dev/api/transactions?account=1234567890"

# Create transaction
curl -X POST "https://sasha-nonreliable-thunderingly.ngrok-free.dev/api/transactions" \
  -H "Content-Type: application/json" \
  -d '{"source_account":"1234567890","target_account":"0987654321","amount":150,"type":"transfer","note":"Test payment"}'

# Update transaction
curl -X PUT "https://sasha-nonreliable-thunderingly.ngrok-free.dev/api/transactions/123" \
  -H "Content-Type: application/json" \
  -d '{"status":"Cancelled"}'

# Cancel transaction
curl -X DELETE "https://sasha-nonreliable-thunderingly.ngrok-free.dev/api/transactions/123"
```

## 🔒 Security Features

- **CORS Headers**: Configured for cross-origin requests
- **Dynamic Schema Detection**: Adapts to database schema changes
- **Input Validation**: Validates required fields and data types
- **Soft Delete**: Transactions are cancelled, not permanently deleted
- **SQL Injection Protection**: Uses prepared statements
- **Error Handling**: Proper HTTP status codes and error messages

## 📋 Migration Notes

### What This Server Handles
- ✅ Transaction CRUD operations
- ✅ Dynamic schema detection (matches Next.js behavior)
- ✅ Query parameter filtering
- ✅ Proper HTTP status codes and CORS
- ✅ JSON request/response handling

### What Stays in Next.js
- ❌ Authentication (session management)
- ❌ Email sending (receipts, notifications)
- ❌ Account management
- ❌ Other non-transaction APIs

### Breaking Changes
- Response format is slightly different (transactions array vs direct array)
- Transaction creation uses `source_account` instead of mixed field names
- Some advanced features like CSV export and receipts are not implemented

## 🐛 Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure server is running on port 8080
   - Check if ngrok tunnel is active
   - Verify firewall settings

2. **Database Connection Failed**
   - Verify PostgreSQL driver is downloaded
   - Check DATABASE_URL is correct
   - Ensure Neon database is accessible

3. **CORS Errors**
   - Server includes CORS headers for all origins
   - Make sure preflight OPTIONS requests work

4. **JSON Parsing Errors**
   - Server uses simple JSON parser
   - Ensure request body is valid JSON
   - Check Content-Type header is set