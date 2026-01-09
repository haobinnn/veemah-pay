/**
 * Java Transaction API Integration
 *
 * Helper functions to integrate Next.js frontend with the Java transaction server
 * that replaces /api/transactions endpoints.
 *
 * AUTOMATIC FALLBACK: All transaction functions now automatically check Java server
 * health before making requests. If the health check fails, they seamlessly fall back
 * to the Next.js API routes for backwards compatibility and reliability.
 */ const JAVA_API_BASE =
	process.env.NEXT_PUBLIC_JAVA_API_URL ||
	process.env.JAVA_TRANSACTION_API ||
	(process.env.NODE_ENV === "production"
		? null // Force fallback to Next.js API in production without explicit config
		: "http://localhost:8081");

/**
 * Create headers for Java API requests, including ngrok bypass for tunnels
 */
function createHeaders(
	contentType: "application/json" | "none" = "application/json"
): HeadersInit {
	const headers: HeadersInit = {
		Accept: "application/json",
	};

	if (contentType === "application/json") {
		headers["Content-Type"] = "application/json";
	}

	// Always add ngrok skip warning header for any external/tunnel requests
	// This is safe to include even for non-ngrok URLs and ensures bypass works
	const shouldAddNgrokHeader = JAVA_API_BASE && (
		JAVA_API_BASE.includes("ngrok") || 
		JAVA_API_BASE.includes("tunnel") ||
		JAVA_API_BASE.includes("ngrok-free.dev") ||
		JAVA_API_BASE.startsWith("https://") ||
		!JAVA_API_BASE.startsWith("http://localhost")
	);
	
	if (shouldAddNgrokHeader) {
		headers["ngrok-skip-browser-warning"] = "true";
		console.log(`🌐 Adding ngrok header for URL: ${JAVA_API_BASE}`);
	}

	return headers;
}

export interface Transaction {
	id: number;
	type: "deposit" | "withdraw" | "transfer";
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
	type: "deposit" | "withdraw" | "transfer";
	note?: string;
	status?: string;
	created_by?: string;
	pin?: string;
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
 * Check if Java server is healthy before making API calls
 */
async function checkJavaServerHealth(): Promise<boolean> {
	try {
		// In production without proper environment variables, skip Java server
		if (config.isProduction && !JAVA_API_BASE) {
			console.log("🔄 Production mode without Java API URL configured, using Next.js API fallback");
			return false;
		}
		
		await checkServerHealth();
		return true;
	} catch (error) {
		console.warn(
			"🔄 Java server health check failed, will use fallback:",
			error
		);
		return false;
	}
}

/**
 * Fallback: Fetch transactions using Next.js API
 */
async function fetchTransactionsNextJS(params: {
	account: string;
	type?: string;
	status?: string;
	from?: string;
	to?: string;
	min_amount?: number;
	max_amount?: number;
	limit?: number;
}): Promise<TransactionResponse> {
	const queryString = new URLSearchParams(
		Object.entries(params)
			.filter(([_, value]) => value !== undefined && value !== null)
			.map(([key, value]) => [key, String(value)])
	).toString();

	const url = `/api/transactions?${queryString}`;
	console.log(`🔗 Fetching transactions from Next.js API: ${url}`);

	const response = await fetch(url, {
		method: "GET",
		headers: { Accept: "application/json" },
	});

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Request failed" }));
		throw new Error(
			error.error || `HTTP ${response.status}: ${response.statusText}`
		);
	}

	const result = await response.json();
	console.log(
		`✅ Fetched ${
			result.transactions?.length || 0
		} transactions from Next.js API`
	);
	return result;
}

/**
 * Fetch transactions for an account with optional filters
 */
export async function fetchTransactions(params: {
	account: string;
	type?: "deposit" | "withdraw" | "transfer";
	status?: string;
	from?: string; // YYYY-MM-DD format
	to?: string; // YYYY-MM-DD format
	min_amount?: number;
	max_amount?: number;
	limit?: number;
}): Promise<TransactionResponse> {
	// First check if Java server is healthy
	const javaServerHealthy = await checkJavaServerHealth();

	if (!javaServerHealthy || !JAVA_API_BASE) {
		console.log("🔄 Falling back to Next.js API for transactions");
		return fetchTransactionsNextJS(params);
	}

	const queryString = new URLSearchParams(
		Object.entries(params)
			.filter(([_, value]) => value !== undefined && value !== null)
			.map(([key, value]) => [key, String(value)])
	).toString();

	const url = `${JAVA_API_BASE}/api/transactions?${queryString}`;
	console.log(`🔗 Fetching transactions from Java server: ${url}`);

	try {
		const response = await fetch(url, {
			method: "GET",
			headers: createHeaders("none"),
		});

		console.log(`📡 Response status: ${response.status}`);

		if (!response.ok) {
			const error: ApiErrorResponse = await response.json();
			throw new Error(
				error.error || `HTTP ${response.status}: ${response.statusText}`
			);
		}

		const result = await response.json();
		console.log(
			`✅ Fetched ${
				result.transactions?.length || 0
			} transactions from Java server`
		);
		return result;
	} catch (error) {
		console.error(
			"❌ Java server transaction fetch failed, falling back to Next.js API:",
			error
		);
		return fetchTransactionsNextJS(params);
	}
}

/**
 * Fetch a single transaction by ID
 */
export async function fetchTransaction(
	id: string | number
): Promise<Transaction> {
	// First check if Java server is healthy
	const javaServerHealthy = await checkJavaServerHealth();

	if (!javaServerHealthy || !JAVA_API_BASE) {
		console.log("🔄 Falling back to Next.js API for single transaction fetch");
		const response = await fetch(`/api/transactions/${id}`, {
			method: "GET",
			headers: { Accept: "application/json" },
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "Request failed" }));
			throw new Error(
				error.error || `HTTP ${response.status}: ${response.statusText}`
			);
		}

		const result = await response.json();
		return result.data || result;
	}

	try {
		const response = await fetch(`${JAVA_API_BASE}/api/transactions/${id}`, {
			method: "GET",
			headers: createHeaders("none"),
		});

		if (!response.ok) {
			const error: ApiErrorResponse = await response.json();
			throw new Error(
				error.error || `HTTP ${response.status}: ${response.statusText}`
			);
		}

		const result = await response.json();
		return result.data;
	} catch (error) {
		console.error(
			"❌ Java server single transaction fetch failed, falling back to Next.js API:",
			error
		);

		const response = await fetch(`/api/transactions/${id}`, {
			method: "GET",
			headers: { Accept: "application/json" },
		});

		if (!response.ok) {
			const fallbackError = await response
				.json()
				.catch(() => ({ error: "Request failed" }));
			throw new Error(
				fallbackError.error || `HTTP ${response.status}: ${response.statusText}`
			);
		}

		const result = await response.json();
		return result.data || result;
	}
}

/**
 * Fallback: Create transaction using Next.js API
 */
async function createTransactionNextJS(
	data: CreateTransactionRequest
): Promise<CreateTransactionResponse> {
	console.log(`🔗 Creating transaction via Next.js API`, data);

	const response = await fetch("/api/transactions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: data.type,
			source_account: data.source_account,
			target_account: data.target_account,
			amount: data.amount,
			note: data.note,
			pending: data.status === "Pending",
			pin: data.pin,
		}),
	});

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Request failed" }));
		throw new Error(
			error.error || `HTTP ${response.status}: ${response.statusText}`
		);
	}

	const result = await response.json();
	console.log(`✅ Transaction created via Next.js API:`, result);

	// Transform Next.js API response to match Java API response format
	return {
		success: true,
		transaction: result.transaction || result,
		message: "Transaction created successfully via Next.js API",
	};
}

/**
 * Create a new transaction
 */
export async function createTransaction(
	data: CreateTransactionRequest
): Promise<CreateTransactionResponse> {
	// First check if Java server is healthy
	const javaServerHealthy = await checkJavaServerHealth();

	if (!javaServerHealthy || !JAVA_API_BASE) {
		console.log("🔄 Falling back to Next.js API for transaction creation");
		return createTransactionNextJS(data);
	}

	const url = `${JAVA_API_BASE}/api/transactions`;
	console.log(`🔗 Creating transaction at Java server: ${url}`, data);

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: createHeaders("application/json"),
			body: JSON.stringify(data),
		});

		console.log(`📡 Create response status: ${response.status}`);

		if (!response.ok) {
			const error: ApiErrorResponse = await response.json();
			throw new Error(
				error.error || `HTTP ${response.status}: ${response.statusText}`
			);
		}

		const result = await response.json();
		console.log(`✅ Transaction created via Java server:`, result);
		return result;
	} catch (error) {
		console.error(
			"❌ Java server transaction creation failed, falling back to Next.js API:",
			error
		);
		return createTransactionNextJS(data);
	}
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(
	id: string | number,
	data: UpdateTransactionRequest
): Promise<CreateTransactionResponse> {
	if (!JAVA_API_BASE) {
		throw new Error("Java API not configured, update operations require Java server");
	}
	
	try {
		const response = await fetch(`${JAVA_API_BASE}/api/transactions/${id}`, {
			method: "PUT",
			headers: createHeaders("application/json"),
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			const error: ApiErrorResponse = await response.json();
			throw new Error(
				error.error || `HTTP ${response.status}: ${response.statusText}`
			);
		}

		return await response.json();
	} catch (error) {
		console.error("Error updating transaction:", error);
		throw error;
	}
}

/**
 * Cancel (soft delete) a transaction
 */
export async function cancelTransaction(
	id: string | number
): Promise<{ success: boolean; message: string }> {
	if (!JAVA_API_BASE) {
		throw new Error("Java API not configured, cancel operations require Java server");
	}
	
	try {
		const response = await fetch(`${JAVA_API_BASE}/api/transactions/${id}`, {
			method: "DELETE",
			headers: createHeaders("none"),
		});

		if (!response.ok) {
			const error: ApiErrorResponse = await response.json();
			throw new Error(
				error.error || `HTTP ${response.status}: ${response.statusText}`
			);
		}

		return await response.json();
	} catch (error) {
		console.error("Error cancelling transaction:", error);
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
	if (!JAVA_API_BASE) {
		throw new Error("Java API base URL not configured");
	}
	
	const url = `${JAVA_API_BASE}/health`;
	console.log(`🔗 Health check URL: ${url}`);

	try {
		const response = await fetch(url, {
			method: "GET",
			headers: createHeaders("none"),
			// Add timeout and other fetch options for better debugging
			signal: AbortSignal.timeout(10000), // 10 second timeout
		});

		console.log(
			`📡 Health check response: ${response.status} ${response.statusText}`
		);
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
		console.error("❌ Health check error details:", {
			name: error instanceof Error ? error.name : "Unknown",
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			url,
			headers: createHeaders("none"),
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
		type: "deposit" | "withdraw" | "transfer";
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
			status: data.pending ? "Pending" : "Completed",
		};

		if (data.target_account) {
			javaRequest.target_account = data.target_account;
		}

		if (data.note) {
			javaRequest.note = data.note;
		}

		return createTransaction(javaRequest);
	},
};

/**
 * Environment configuration helper
 */
export const config = {
	apiBase: JAVA_API_BASE,
	isProduction: process.env.NODE_ENV === "production",

	// Check if we should use Java server or Next.js API
	useJavaServer: process.env.USE_JAVA_TRANSACTIONS !== "false",

	// Health check fallback is now automatic - all transaction functions
	// will check Java server health first and fall back to Next.js API if needed
	autoFallback: true,

	// Log configuration for debugging
	logConfig() {
		const shouldAddNgrokHeader = JAVA_API_BASE && (
			JAVA_API_BASE.includes("ngrok") || 
			JAVA_API_BASE.includes("tunnel") ||
			JAVA_API_BASE.includes("ngrok-free.dev") ||
			JAVA_API_BASE.startsWith("https://") ||
			!JAVA_API_BASE.startsWith("http://localhost")
		);
		
		console.log("🔧 Java API Configuration:", {
			apiBase: this.apiBase,
			isProduction: this.isProduction,
			useJavaServer: this.useJavaServer,
			autoFallback: this.autoFallback,
			shouldAddNgrokHeader,
			ngrokDetection: {
				containsNgrok: this.apiBase?.includes("ngrok"),
				containsTunnel: this.apiBase?.includes("tunnel"), 
				containsNgrokFreeDev: this.apiBase?.includes("ngrok-free.dev"),
				isHttps: this.apiBase?.startsWith("https://"),
				isNotLocalhost: this.apiBase && !this.apiBase.startsWith("http://localhost")
			},
			env: {
				NEXT_PUBLIC_JAVA_API_URL: process.env.NEXT_PUBLIC_JAVA_API_URL,
				JAVA_TRANSACTION_API: process.env.JAVA_TRANSACTION_API,
				NODE_ENV: process.env.NODE_ENV,
				USE_JAVA_TRANSACTIONS: process.env.USE_JAVA_TRANSACTIONS,
			},
		});
	},
};

/**
 * Fallback function that tries Java server first, then Next.js API
 */
export async function fetchTransactionsWithFallback(params: {
	account: string;
	[key: string]: any;
}) {
	if (config.useJavaServer) {
		try {
			return await fetchTransactions(params);
		} catch (error) {
			console.warn("Java server failed, falling back to Next.js API:", error);

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
