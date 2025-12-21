import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  const { message, history } = await req.json();
  const session = req.cookies.get('session')?.value;

  let userContext = "User is not logged in. Treat them as a guest interested in VeemahPay banking services.";
  let user: any = null;
  let recentTx: any[] = [];
  let stats = { total_accounts: 0, total_balance: 0, active_count: 0, locked_count: 0 };
  let txLines = "No recent transactions found.";

  if (session) {
    try {
      if (session === '0000') {
        // --- ADMIN LOGIC ---
        user = { name: "Administrator", account_number: "0000", status: "Active" };
        
        try {
            // 1. Fetch System Stats
            const statsRes = await pool.query(`
            SELECT 
                COUNT(*) as total_accounts,
                COALESCE(SUM(balance), 0) as total_balance,
                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_count,
                SUM(CASE WHEN status = 'Locked' THEN 1 ELSE 0 END) as locked_count
            FROM accounts
            `);
            stats = statsRes.rows[0];
        } catch (e) {
            console.error("Admin stats fetch failed:", e);
        }

        try {
            // 2. Fetch Recent Global Transactions
            const txRes = await pool.query(`
            SELECT t.type, t.amount, t.status, t.created_at, a.name as source_name
            FROM transactions t
            LEFT JOIN accounts a ON t.account_number = a.account_number
            ORDER BY t.created_at DESC LIMIT 8
            `);
            recentTx = txRes.rows;

            if (recentTx.length > 0) {
                txLines = recentTx.map((t: any) => 
                `- ${t.type.toUpperCase()} ₱${Number(t.amount).toFixed(2)} (${t.status}) by ${t.source_name || 'Unknown'} on ${new Date(t.created_at).toLocaleDateString()}`
                ).join('\n');
            }
        } catch (e) {
            console.error("Admin tx fetch failed:", e);
        }

        userContext = `
          ROLE: SYSTEM ADMINISTRATOR
          
          SYSTEM HEALTH OVERVIEW:
          - Total Accounts Managed: ${stats.total_accounts}
          - Total Funds in System: ₱${Number(stats.total_balance).toFixed(2)}
          - Active Accounts: ${stats.active_count}
          - Locked Accounts: ${stats.locked_count}
          
          RECENT SYSTEM-WIDE TRANSACTIONS:
          ${txLines}
        `;

      } else {
        // --- REGULAR USER LOGIC ---
        let userRes;
        try {
            const colCheck = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
            );
            const cols: string[] = colCheck.rows.map((r: any) => r.column_name);
            const hasEmail = cols.includes('email');
            
            userRes = hasEmail
            ? await pool.query(
                `SELECT account_number, name, balance::float as balance, status, email FROM accounts WHERE account_number = $1`,
                [session]
                )
            : await pool.query(
                `SELECT account_number, name, balance::float as balance, status FROM accounts WHERE account_number = $1`,
                [session]
                );
        } catch (e) {
            console.error("User fetch failed:", e);
        }

        if (userRes && (userRes.rowCount ?? 0) > 0) {
          user = userRes.rows[0];
          
          let transactions = "No recent transactions.";
          try {
              const txRes = await pool.query(
                `SELECT type, amount::float as amount, status, created_at, account_number, target_account 
                FROM transactions 
                WHERE account_number = $1 OR target_account = $1
                ORDER BY created_at DESC LIMIT 5`,
                [session]
              );
              recentTx = txRes.rows;
              if (recentTx.length > 0) {
                  transactions = recentTx.map((t: any) => {
                    const isCredit = t.target_account === session && t.type === 'transfer';
                    const isDebit = t.account_number === session;
                    const sign = isCredit ? '+' : (isDebit && t.type !== 'deposit' ? '-' : ''); 
                    // Deposit is credit to balance, but logged as source_account for simplicity in this schema? 
                    // Actually in the deposit logic: update accounts set balance = balance + amt where account_number = source.
                    // So for deposit, source is the beneficiary.
                    
                    return `- ${t.type.toUpperCase()} ₱${t.amount} (${t.status}) on ${new Date(t.created_at).toLocaleDateString()}`;
                  }).join('\n');
              }
          } catch (e) {
              console.error("User tx fetch failed:", e);
          }

          const hasEmail = user.email ? true : false; // simplistic check
          userContext = `
            User Name: ${user.name}
            Account Number: ${user.account_number}
            Current Balance: ₱${Number(user.balance).toFixed(2)}
            Status: ${user.status}
            ${hasEmail ? `Email: ${user.email}` : ''}
            
            Recent Transactions:
            ${transactions}
          `;
        } else {
        }
      }
    } catch (err) {
      console.error("Error fetching user context (outer):", err);
    }
  } else {
  }

  const systemPrompt = `
    You are Veema, an advanced and intelligent AI banking assistant for VeemahPay.
    
    CONTEXT ABOUT THE USER:
    ${userContext}
    
    ROLE & PERSONALITY:
    - You are smart, proactive, and empathetic.
    - You speak naturally in English or Tagalog/Taglish, adapting to the user's language.
    - You are knowledgeable about financial terms but explain them simply.
    
    CAPABILITIES:
    1. **Account Insights**: Analyze balance and transactions.
    2. **Financial Advice**: Offer practical tips.
    3. **Product Knowledge**: Explain features.
    4. **Security**: Never ask for PINs/passwords.
    
    INSTRUCTIONS:
    - Answer directly and concisely. Avoid robotic greetings every time.
    - If the context indicates **SYSTEM ADMINISTRATOR**, you are an Executive Assistant. 
      - Provide high-level summaries of system health.
      - If asked about "transactions", show the global transaction log provided.
      - If asked about "status", summarize the active vs locked counts.
      - Be professional, concise, and data-driven.
    - If the user is a **CUSTOMER**, focus on their personal account details provided in context.
    - If the user is stressed or confused, be reassuring.
    - Format your responses nicely (use bullet points for lists).
  `;

  const canUseGemini = !!GEMINI_API_KEY;

  if (canUseGemini) {
    try {
      const contents = (history || []).map((msg: any) => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] }));
      contents.push({ role: 'user', parts: [{ text: systemPrompt + "\n\nUser Message: " + message }] });

      const models = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest'
      ];

      for (const m of models) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
          });
          const data = await response.json();
          if (!response.ok) {
            console.error("Gemini API Error:", { model: m, status: response.status, data });
            continue;
          }
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply && typeof reply === 'string' && reply.trim().length > 0) {
            return NextResponse.json({ reply });
          }
        } catch (innerErr) {
          console.error("Gemini attempt failed:", { model: m, err: innerErr });
          continue;
        }
      }
      console.error("Chat - All Gemini model attempts failed, using Smart Mode");
    } catch (err) {
      console.error("Chat - Gemini Exception:", err);
    }
  } else {
  }

  // Fallback / Mock AI Logic
  let reply = "Sorry, I am currently offline.";
  
  if (user) {
    if (session === '0000') {
       // Admin Mock
       if (/status|health|users/i.test(message)) {
         reply = `**System Health**\n• Accounts: ${stats.total_accounts}\n• Active: ${stats.active_count}\n• Locked: ${stats.locked_count}\n• Total Funds: ₱${Number(stats.total_balance).toLocaleString()}`;
       } else if (/transaction/i.test(message)) {
         reply = `**Recent Global Activity**\n${txLines}`;
       } else {
         reply = `**Admin Console**\nI'm ready. Ask me about system status or global transactions.`;
       }
    } else {
      // User Mock
      const lowerMsg = message.toLowerCase();
      if (/hello|hi|hey/i.test(lowerMsg)) {
        reply = `Hello ${user.name.split(' ')[0]}! 👋 I'm Veema. How can I help you with your account today?`;
      } else if (/balance|money|funds/i.test(lowerMsg)) {
        reply = `Your current balance is **₱${Number(user.balance).toLocaleString()}**.`;
      } else if (/transaction|history|activity/i.test(lowerMsg)) {
        const txList = recentTx.length > 0 
          ? recentTx.map((t: any) => `• ${t.type.toUpperCase()} ₱${t.amount} (${t.status})`).join('\n')
          : "No recent transactions found.";
        reply = `Here are your recent transactions:\n\n${txList}`;
      } else if (/deposit/i.test(lowerMsg)) {
        reply = "To deposit, go to your Dashboard and click 'Deposit'. You can add funds instantly.";
      } else if (/transfer|send/i.test(lowerMsg)) {
        reply = "You can transfer money by clicking 'Transfer' in your Dashboard. You'll need the recipient's account number.";
      } else if (/withdraw/i.test(lowerMsg)) {
        reply = "To withdraw funds, use the 'Withdraw' card on your dashboard. You'll need your PIN.";
      } else if (/status/i.test(lowerMsg)) {
        reply = `Your account status is currently **${user.status}**.`;
      } else {
        reply = `I'm in **Smart Mode** (AI Offline). I can help with basic tasks!\n\nTry asking:\n• "What is my balance?"\n• "Show my transactions"\n• "How to withdraw?"`;
      }
    }
  } else {
    reply = `I can't access an account yet. Please log in first. In the meantime, I can tell you that VeemahPay is the secure way to manage your money!`;
  }

  return NextResponse.json({ reply });
}
