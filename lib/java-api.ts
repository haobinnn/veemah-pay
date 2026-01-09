/**
 * Java Transaction API Integration
 * 
 * Helper functions to integrate Next.js frontend with the Java transaction server
 * that replaces /api/transactions endpoints.
 */

const JAVA_API_BASE = process.env.NEXT_PUBLIC_JAVA_API_URL || 
  process.env.JAVA_TRANSACTION_API || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://sasha-nonreliable-thunderingly.ngrok-free.dev'
    : 'http://localhost:8081');

/**
 * Create headers for Java API requests, including ngrok bypass for tunnels
 */
function createHeaders(contentType: 'application/json' | 'none' = 'application/json'): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  
  if (contentType === 'application/json') {
    headers['Content-Type'] = 'application/json';
  }
  
  // Add ngrok skip warning header for tunnel requests
  if (JAVA_API_BASE.includes('ngrok') || JAVA_API_BASE.includes('tunnel')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  
  return headers;
}

export interface Transaction {
  id: number;
  type: 'deposit' | 'withdraw' | 'transfer';
  status: string;
  account_number: string;
  target_account?: string;
  amount: number;
  fee?: number;
  note?: string;
  created_by?: string;
  created_at: string;
  completed_at?: string;
  voided_at?: string;
  source_balance_before?: number;
  source_balance_after?: number;
  target_balance_before?: number;
  target_balance_after?: number;
}

export interface TransactionResponse {
  transactions: Transaction[];
  next_cursor?: string;
}

export interface CreateTransactionRequest {
  source_account: string;
  target_account?: string;
  amount: number;
  type: 'deposit' | 'withdraw' | 'transfer';
  note?: string;
  status?: string;
  created_by?: string;
}

export interface CreateTransactionResponse {
  success: boolean;
  transaction: Transaction;
  message: string;
}

export interface UpdateTransactionRequest {
  status?: string;
  note?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  timestamp: string;
}

/**
 * Fetch transactions for an account with optional filters
 */
export async function fetchTransactions(params: {
  account: string;
  type?: 'deposit' | 'withdraw' | 'transfer';
  status?: string;
  from?: string; // YYYY-MM-DD format
  to?: string;   // YYYY-MM-DD format
  min_amount?: number;
  max_amount?: number;
  limit?: number;
}): Promise<TransactionResponse> {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  ).toString();
  
  const url = `${JAVA_API_BASE}/api/transactions?${queryString}`;
  console.log(`🔗 Fetching transactions from: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders('none'),
    });
    
    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      const error: ApiErrorResponse = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Fetched ${result.transactions?.length || 0} transactions`);
    return result;
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Fetch a single transaction by ID
 */
export async function fetchTransaction(id: string | number): Promise<Transaction> {
  try {
    const response = await fetch(`${JAVA_API_BASE}/api/transactions/${id}`, {
      method: 'GET',
      headers: createHeaders('none'),
    });
    
    if (!response.ok) {
      const error: ApiErrorResponse = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching transaction:', error);
    throw error;
  }
}

/**
 * Create a new transaction
 */
export async function createTransaction(data: CreateTransactionRequest): Promise<CreateTransactionResponse> {
  const url = `${JAVA_API_BASE}/api/transactions`;
  console.log(`🔗 Creating transaction at: ${url}`, data);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: createHeaders('application/json'),
      body: JSON.stringify(data),
    });
    
    console.log(`📡 Create response status: ${response.status}`);
    
    if (!response.ok) {
      const error: ApiErrorResponse = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Transaction created:`, result);
    return result;
  } catch (error) {
    console.error('❌ Error creating transaction:', error);
    throw error;
  }
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(
  id: string | number, 
  data: UpdateTransactionRequest
): Promise<CreateTransactionResponse> {
  try {
    const response = await fetch(`${JAVA_API_BASE}/api/transactions/${id}`, {
      method: 'PUT',
      headers: createHeaders('application/json'),
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error: ApiErrorResponse = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }
}

/**
 * Cancel (soft delete) a transaction
 */
export async function cancelTransaction(id: string | number): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${JAVA_API_BASE}/api/transactions/${id}`, {
      method: 'DELETE',
      headers: createHeaders('none'),
    });
    
    if (!response.ok) {
      const error: ApiErrorResponse = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error cancelling transaction:', error);
    throw error;
  }
}

/**
 * Check if the Java transaction server is healthy
 */
export async function checkServerHealth(): Promise<{
  status: string;
  service: string;
  database: string;
  timestamp: string;
}> {
  const url = `${JAVA_API_BASE}/health`;
  console.log(`🔗 Health check URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders('none'),
      // Add timeout and other fetch options for better debugging
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    console.log(`📡 Health check response: ${response.status} ${response.statusText}`);
    console.log(`🔍 Response URL:`, response.url);
    console.log(`🔍 Response type:`, response.type);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error response body:`, errorText);
      throw new Error(`Health check failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Health check successful:`, result);
    return result;
  } catch (error) {
    console.error('❌ Health check error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url,
      headers: createHeaders('none')
    });
    throw error;
  }
}

/**
 * Migration helper: Replace existing Next.js API calls
 * 
 * Usage:
 * 
 * // Before (Next.js API)
 * const res = await fetch('/api/transactions?account=123');
 * const data = await res.json();
 * 
 * // After (Java Server)
 * const data = await fetchTransactions({ account: '123' });
 */
export const migrateFromNextJS = {
  /**
   * Replace GET /api/transactions
   */
  getTransactions: fetchTransactions,
  
  /**
   * Replace POST /api/transactions
   * 
   * Note: Field mapping changes:
   * - Next.js used mixed field names
   * - Java server uses consistent naming:
   *   - source_account (was account_number in some cases)
   *   - target_account (consistent)
   *   - type, amount, note (unchanged)
   */
  createTransaction: (data: {
    type: 'deposit' | 'withdraw' | 'transfer';
    source_account: string;
    target_account?: string;
    amount: number;
    note?: string;
    pending?: boolean;
    pin?: string; // Note: PIN validation removed in Java server
  }) => {
    // Map Next.js request format to Java server format
    const javaRequest: CreateTransactionRequest = {
      source_account: data.source_account,
      type: data.type,
      amount: data.amount,
      status: data.pending ? 'Pending' : 'Completed',
    };
    
    if (data.target_account) {
      javaRequest.target_account = data.target_account;
    }
    
    if (data.note) {
      javaRequest.note = data.note;
    }
    
    return createTransaction(javaRequest);
  }
};

/**
 * Environment configuration helper
 */
export const config = {
  apiBase: JAVA_API_BASE,
  isProduction: process.env.NODE_ENV === 'production',
  
  // Check if we should use Java server or Next.js API
  useJavaServer: process.env.USE_JAVA_TRANSACTIONS !== 'false',
  
  // Log configuration for debugging
  logConfig() {
    console.log('🔧 Java API Configuration:', {
      apiBase: this.apiBase,
      isProduction: this.isProduction,
      useJavaServer: this.useJavaServer,
      hasNgrokHeader: this.apiBase.includes('ngrok') || this.apiBase.includes('tunnel'),
      env: {
        NEXT_PUBLIC_JAVA_API_URL: process.env.NEXT_PUBLIC_JAVA_API_URL,
        JAVA_TRANSACTION_API: process.env.JAVA_TRANSACTION_API,
        NODE_ENV: process.env.NODE_ENV,
        USE_JAVA_TRANSACTIONS: process.env.USE_JAVA_TRANSACTIONS,
      }
    });
  }
};

/**
 * Fallback function that tries Java server first, then Next.js API
 */
export async function fetchTransactionsWithFallback(params: { account: string; [key: string]: any }) {
  if (config.useJavaServer) {
    try {
      return await fetchTransactions(params);
    } catch (error) {
      console.warn('Java server failed, falling back to Next.js API:', error);
      
      // Fallback to Next.js API
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/api/transactions?${queryString}`);
      if (!response.ok) {
        throw new Error(`Next.js API also failed: ${response.status}`);
      }
      return await response.json();
    }
  } else {
    // Use Next.js API directly
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`/api/transactions?${queryString}`);
    if (!response.ok) {
      throw new Error(`Next.js API failed: ${response.status}`);
    }
    return await response.json();
  }
}