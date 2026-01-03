"use client";
import React, { useMemo } from 'react';
import {
  Area,
  Bar,
  BarChart,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line
} from 'recharts';
import { useLanguage } from '@/components/ui/LanguageProvider';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';

type Transaction = {
  id: number;
  type: string;
  status: string;
  amount: number;
  created_at?: string;
  note?: string | null;
};

type Props = {
  transactions: Transaction[];
};

type DailyPoint = {
  dateKey: string;
  dateLabel: string;
  income: number;
  expense: number;
  net: number;
  expenseAvg7: number | null;
};

type CategoryPoint = {
  category: string;
  amount: number;
};

type MonthPoint = {
  monthKey: string;
  monthLabel: string;
  income: number;
  expense: number;
  net: number;
};

function formatMoney(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0.00';
  return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function inferCategory(tx: Transaction) {
  const note = String(tx.note ?? '').trim().toLowerCase();
  const t = String(tx.type ?? '').toLowerCase();

  if (t === 'fee') return 'Fees';
  if (t === 'transfer') return 'Transfers';
  if (t === 'withdraw') return 'Cash';
  if (t === 'deposit') return 'Income';

  const rules: Array<{ category: string; test: (s: string) => boolean }> = [
    { category: 'Groceries', test: (s) => /grocery|supermarket|market|sari|mart|palengke/.test(s) },
    { category: 'Dining', test: (s) => /dining|restaurant|cafe|coffee|food|grabfood|foodpanda|jollibee|mcdonald|kfc/.test(s) },
    { category: 'Transport', test: (s) => /transport|commute|taxi|grab|jeep|bus|mrt|lrt|gas|fuel|parking|toll/.test(s) },
    { category: 'Utilities', test: (s) => /utility|electric|water|internet|wifi|phone|load|globe|smart|pldt|meralco|maynilad|primewater/.test(s) },
    { category: 'Shopping', test: (s) => /shopping|store|mall|lazada|shopee|amazon|clothes|apparel/.test(s) },
    { category: 'Entertainment', test: (s) => /entertain|movie|cinema|netflix|spotify|game|steam/.test(s) },
    { category: 'Health', test: (s) => /health|clinic|hospital|pharmacy|drug|medicine|doctor/.test(s) },
    { category: 'Education', test: (s) => /school|tuition|university|college|course|training/.test(s) },
    { category: 'Rent', test: (s) => /rent|lease|landlord/.test(s) },
  ];

  const matched = rules.find((r) => r.test(note));
  return matched?.category ?? 'Other';
}

function movingAverage(values: number[], windowSize: number) {
  const out: Array<number | null> = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= windowSize) sum -= values[i - windowSize];
    if (i >= windowSize - 1) out[i] = sum / windowSize;
  }
  return out;
}

export function SpendingGraph({ transactions }: Props) {
  const { t } = useLanguage();
  const analytics = useMemo(() => {
    const completed = transactions.filter((tx) => String(tx.status) === 'Completed');
    const now = new Date();
    const fallbackEnd = toDateKey(now);

    const dailyTotals = new Map<string, { income: number; expense: number }>();
    const monthTotals = new Map<string, { income: number; expense: number }>();
    const categoryTotals = new Map<string, number>();

    let maxDateKey = '';

    for (const tx of completed) {
      const dt = tx.created_at ? new Date(tx.created_at) : now;
      const dateKey = toDateKey(dt);
      const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (!maxDateKey || dateKey > maxDateKey) maxDateKey = dateKey;

      const amt = Number(tx.amount);
      if (!Number.isFinite(amt) || amt <= 0) continue;

      const type = String(tx.type ?? '').toLowerCase();
      const day = dailyTotals.get(dateKey) ?? { income: 0, expense: 0 };
      const month = monthTotals.get(monthKey) ?? { income: 0, expense: 0 };

      if (type === 'deposit') {
        day.income += amt;
        month.income += amt;
      } else if (type === 'withdraw' || type === 'transfer' || type === 'fee') {
        day.expense += amt;
        month.expense += amt;

        const c = inferCategory(tx);
        categoryTotals.set(c, (categoryTotals.get(c) ?? 0) + amt);
      }

      dailyTotals.set(dateKey, day);
      monthTotals.set(monthKey, month);
    }

    const endDateKey = maxDateKey || fallbackEnd;
    const endDate = new Date(`${endDateKey}T00:00:00`);
    const startDate = addDays(endDate, -29);

    const daily: DailyPoint[] = [];
    for (let i = 0; i < 30; i++) {
      const d = addDays(startDate, i);
      const key = toDateKey(d);
      const totals = dailyTotals.get(key) ?? { income: 0, expense: 0 };
      daily.push({
        dateKey: key,
        dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        income: totals.income,
        expense: totals.expense,
        net: totals.income - totals.expense,
        expenseAvg7: null,
      });
    }

    const avg = movingAverage(daily.map((d) => d.expense), 7);
    for (let i = 0; i < daily.length; i++) daily[i].expenseAvg7 = avg[i];

    const monthKeys = Array.from(monthTotals.keys()).sort((a, b) => a.localeCompare(b));
    const months: MonthPoint[] = monthKeys.slice(-6).map((k) => {
      const [y, m] = k.split('-').map((x) => Number(x));
      const d = new Date(y, (m ?? 1) - 1, 1);
      const totals = monthTotals.get(k) ?? { income: 0, expense: 0 };
      return {
        monthKey: k,
        monthLabel: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        income: totals.income,
        expense: totals.expense,
        net: totals.income - totals.expense,
      };
    });

    const catSorted = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount }));

    const top = catSorted.slice(0, 6);
    const rest = catSorted.slice(6).reduce((s, c) => s + c.amount, 0);
    const categories: CategoryPoint[] = rest > 0 ? [...top, { category: t('graph.other'), amount: rest }] : top;

    const last30Income = daily.reduce((s, d) => s + d.income, 0);
    const last30Expense = daily.reduce((s, d) => s + d.expense, 0);
    const last30Net = last30Income - last30Expense;

    const thisMonthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
    const lastMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const thisMonthExpense = monthTotals.get(thisMonthKey)?.expense ?? 0;
    const lastMonthExpense = monthTotals.get(lastMonthKey)?.expense ?? 0;
    const monthChangePct =
      lastMonthExpense > 0 ? ((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100 : null;

    return {
      daily,
      categories,
      months,
      last30Income,
      last30Expense,
      last30Net,
      thisMonthExpense,
      lastMonthExpense,
      monthChangePct,
      hasAny: completed.length > 0,
    };
  }, [transactions, t]);

  if (!analytics.hasAny) {
    return (
      <div style={{ 
        padding: 40, 
        textAlign: 'center', 
        color: 'var(--muted)',
        background: 'linear-gradient(180deg, rgba(10,107,255,0.05) 0%, rgba(0,0,0,0) 100%)',
        borderRadius: 12,
        border: '1px dashed var(--border)'
      }}>
        {t('graph.no_data')}
      </div>
    );
  }

  const statRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 16,
  };

  const statCardStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    background: 'linear-gradient(180deg, rgba(10,107,255,0.06) 0%, rgba(0,0,0,0) 100%)',
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--muted)',
    marginBottom: 6,
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  };

  const trendText = analytics.monthChangePct === null
    ? '—'
    : `${analytics.monthChangePct >= 0 ? '+' : ''}${analytics.monthChangePct.toFixed(1)}%`;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={statRowStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>{t('graph.last_30_days')} · {t('graph.income')}</div>
          <div style={statValueStyle}>
            <MoneyDisplay amount={analytics.last30Income} />
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>{t('graph.last_30_days')} · {t('graph.expense')}</div>
          <div style={statValueStyle}>
            <MoneyDisplay amount={analytics.last30Expense} />
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>{t('graph.last_30_days')} · {t('graph.net')}</div>
          <div style={statValueStyle}>
            <MoneyDisplay amount={analytics.last30Net} colorize={true} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>{t('graph.this_month')} · {t('graph.expense')}</div>
          <div style={statValueStyle}>
            <MoneyDisplay amount={analytics.thisMonthExpense} />
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>{t('graph.last_month')} · {t('graph.expense')}</div>
          <div style={statValueStyle}>
            <MoneyDisplay amount={analytics.lastMonthExpense} />
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>{t('graph.change')}</div>
          <div style={statValueStyle}>{trendText}</div>
        </div>
      </div>

      <div style={{ width: '100%', height: 340, position: 'relative' }}>
        <ResponsiveContainer>
          <ComposedChart
            data={analytics.daily}
            margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff0055" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#ff0055" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="dateLabel"
              stroke="var(--muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="var(--muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `₱${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
              dx={-5}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 22, 40, 0.85)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                backdropFilter: 'blur(8px)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              itemStyle={{ fontSize: 13, fontWeight: 500 }}
              labelStyle={{ color: 'var(--muted)', marginBottom: 8, fontSize: 12 }}
              cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
              formatter={(value: any, name: any) => [formatMoney(Number(value)), name]}
            />
            <Legend wrapperStyle={{ paddingTop: 10 }} iconType="circle" />

            <Area
              type="monotone"
              dataKey="income"
              name={t('graph.income')}
              stroke="#00f2ff"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorIncome)"
              activeDot={{ r: 6, strokeWidth: 0, fill: '#00f2ff', filter: 'drop-shadow(0 0 8px #00f2ff)' }}
              animationDuration={1200}
            />
            <Area
              type="monotone"
              dataKey="expense"
              name={t('graph.expense')}
              stroke="#ff0055"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorExpense)"
              activeDot={{ r: 6, strokeWidth: 0, fill: '#ff0055', filter: 'drop-shadow(0 0 8px #ff0055)' }}
              animationDuration={1200}
            />
            <Line
              type="monotone"
              dataKey="expenseAvg7"
              name={t('graph.expense_avg_7d')}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="hBox-wrappper">
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t('graph.expense_by_category')}</div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={analytics.categories} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                <XAxis dataKey="category" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 22, 40, 0.85)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                  formatter={(value: any) => formatMoney(Number(value))}
                />
                <Bar dataKey="amount" fill="rgba(255, 0, 85, 0.75)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t('graph.monthly_trend')}</div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart data={analytics.months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                <XAxis dataKey="monthLabel" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 22, 40, 0.85)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                  formatter={(value: any, name: any) => [formatMoney(Number(value)), name]}
                />
                <Legend wrapperStyle={{ paddingTop: 6 }} iconType="circle" />
                <Bar dataKey="income" name={t('graph.income')} fill="rgba(0, 242, 255, 0.55)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" name={t('graph.expense')} fill="rgba(255, 0, 85, 0.55)" radius={[8, 8, 0, 0]} />
                <Line type="monotone" dataKey="net" name={t('graph.net')} stroke="rgba(255,255,255,0.65)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
