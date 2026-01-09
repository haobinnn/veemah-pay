"use client";
import React, { useEffect, useMemo, useState } from 'react';
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
  Line,
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

type TimeRange = '7d' | '30d' | '90d' | 'ytd';

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
  thisPeriod: number;
  prevPeriod: number;
  deltaAbs: number;
  deltaPct: number | null;
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

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

function sameDayLastYear(d: Date) {
  return new Date(d.getFullYear() - 1, d.getMonth(), d.getDate());
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
  const [selectedRange, setSelectedRange] = useState<TimeRange>('30d');
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const el = document.documentElement;
    const readTheme = () => (el.getAttribute("data-theme") === "light" ? "light" : "dark");
    setTheme(readTheme());
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const isDark = theme === "dark";
  const incomeStroke = isDark ? "#00f2ff" : "#0aa2c0";
  const expenseStroke = isDark ? "#ff0055" : "#d81b60";
  const areaFillOpacity = isDark ? 0.35 : 0.22;
  const gridOpacity = isDark ? 0.3 : 0.45;
  const avgStroke = isDark ? "rgba(255,255,255,0.55)" : "rgba(15, 22, 40, 0.55)";
  const netStroke = isDark ? "rgba(255,255,255,0.65)" : "rgba(15, 22, 40, 0.6)";
  const cursorStroke = isDark ? "rgba(255,255,255,0.2)" : "rgba(15,22,40,0.18)";
  const tooltipBg = isDark ? "rgba(15, 22, 40, 0.85)" : "rgba(255,255,255,0.96)";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(15,22,40,0.12)";
  const tooltipText = isDark ? "#fff" : "var(--text)";
  const tooltipShadow = isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 10px 28px rgba(15,22,40,0.18)";
  const tooltipLabelColor = isDark ? "rgba(255,255,255,0.72)" : "var(--muted)";
  const axisStroke = isDark ? "rgba(255,255,255,0.8)" : "var(--muted)";
  const categoryThisFill = isDark ? "rgba(255, 0, 85, 0.75)" : "rgba(216, 27, 96, 0.78)";
  const categoryPrevFill = isDark ? "rgba(255, 0, 85, 0.25)" : "rgba(216, 27, 96, 0.38)";
  const categoryPrevStroke = isDark ? "rgba(255, 0, 85, 0.55)" : "rgba(216, 27, 96, 0.62)";
  const monthIncomeFill = isDark ? "rgba(0, 242, 255, 0.55)" : "rgba(10, 162, 192, 0.75)";
  const monthExpenseFill = isDark ? "rgba(255, 0, 85, 0.55)" : "rgba(216, 27, 96, 0.75)";
  

  const rangeLabel =
    selectedRange === '7d'
      ? t('graph.range_7d')
      : selectedRange === '30d'
        ? t('graph.range_30d')
        : selectedRange === '90d'
          ? t('graph.range_90d')
          : t('graph.range_ytd');

  const analytics = useMemo(() => {
    const completed = transactions.filter((tx) => String(tx.status) === 'Completed');
    const endDate = new Date();
    const otherLabel = t('graph.other');

    const rangeStartDate =
      selectedRange === '7d'
        ? addDays(endDate, -6)
        : selectedRange === '30d'
          ? addDays(endDate, -29)
          : selectedRange === '90d'
            ? addDays(endDate, -89)
            : startOfYear(endDate);
    rangeStartDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const prevEndDate =
      selectedRange === 'ytd' ? sameDayLastYear(endDate) : addDays(endDate, selectedRange === '7d' ? -7 : selectedRange === '30d' ? -30 : -90);
    prevEndDate.setHours(23, 59, 59, 999);

    const prevStartDate =
      selectedRange === 'ytd'
        ? startOfYear(prevEndDate)
        : addDays(prevEndDate, selectedRange === '7d' ? -6 : selectedRange === '30d' ? -29 : -89);
    prevStartDate.setHours(0, 0, 0, 0);

    const inWindow = (d: Date, start: Date, end: Date) => d.getTime() >= start.getTime() && d.getTime() <= end.getTime();

    const dailyTotals = new Map<string, { income: number; expense: number }>();
    const monthTotals = new Map<string, { income: number; expense: number }>();
    const categoryTotalsThis = new Map<string, number>();
    const categoryTotalsPrev = new Map<string, number>();

    let hasAnyInRange = false;
    let periodIncome = 0;
    let periodExpense = 0;
    let prevPeriodIncome = 0;
    let prevPeriodExpense = 0;

    for (const tx of completed) {
      const dt = tx.created_at ? new Date(tx.created_at) : new Date();
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getTime() > endDate.getTime()) continue;

      const amt = Number(tx.amount);
      if (!Number.isFinite(amt) || amt <= 0) continue;

      const type = String(tx.type ?? '').toLowerCase();
      const isIncome = type === 'deposit';
      const isExpense = type === 'withdraw' || type === 'transfer' || type === 'fee';

      const dateKey = toDateKey(dt);
      const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;

      if (inWindow(dt, rangeStartDate, endDate)) {
        hasAnyInRange = true;

        const day = dailyTotals.get(dateKey) ?? { income: 0, expense: 0 };
        const month = monthTotals.get(monthKey) ?? { income: 0, expense: 0 };

        if (isIncome) {
          day.income += amt;
          month.income += amt;
          periodIncome += amt;
        } else if (isExpense) {
          day.expense += amt;
          month.expense += amt;
          periodExpense += amt;

          const inferred = inferCategory(tx);
          const c = inferred === 'Other' ? otherLabel : inferred;
          categoryTotalsThis.set(c, (categoryTotalsThis.get(c) ?? 0) + amt);
        }

        dailyTotals.set(dateKey, day);
        monthTotals.set(monthKey, month);
      } else if (inWindow(dt, prevStartDate, prevEndDate)) {
        if (isIncome) {
          prevPeriodIncome += amt;
        } else if (isExpense) {
          prevPeriodExpense += amt;
          const inferred = inferCategory(tx);
          const c = inferred === 'Other' ? otherLabel : inferred;
          categoryTotalsPrev.set(c, (categoryTotalsPrev.get(c) ?? 0) + amt);
        }
      }
    }

    const startDay = new Date(rangeStartDate);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);
    const totalDays = Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / 86400000) + 1);

    const daily: DailyPoint[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(startDay, i);
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

    const allCats = new Set<string>([...categoryTotalsThis.keys(), ...categoryTotalsPrev.keys()]);
    const catRows = Array.from(allCats).map((category) => {
      const thisPeriod = categoryTotalsThis.get(category) ?? 0;
      const prevPeriod = categoryTotalsPrev.get(category) ?? 0;
      const deltaAbs = thisPeriod - prevPeriod;
      const deltaPct = prevPeriod > 0 ? (deltaAbs / prevPeriod) * 100 : null;
      return { category, thisPeriod, prevPeriod, deltaAbs, deltaPct };
    });

    catRows.sort((a, b) => {
      if (b.thisPeriod !== a.thisPeriod) return b.thisPeriod - a.thisPeriod;
      return b.prevPeriod - a.prevPeriod;
    });

    const topCats = catRows.slice(0, 6).map((r) => ({ ...r }));
    const restCats = catRows.slice(6);
    const restThis = restCats.reduce((s, r) => s + r.thisPeriod, 0);
    const restPrev = restCats.reduce((s, r) => s + r.prevPeriod, 0);
    if (restThis > 0 || restPrev > 0) {
      const idx = topCats.findIndex((r) => r.category === otherLabel);
      if (idx >= 0) {
        const mergedThis = topCats[idx].thisPeriod + restThis;
        const mergedPrev = topCats[idx].prevPeriod + restPrev;
        const mergedDeltaAbs = mergedThis - mergedPrev;
        topCats[idx] = {
          category: otherLabel,
          thisPeriod: mergedThis,
          prevPeriod: mergedPrev,
          deltaAbs: mergedDeltaAbs,
          deltaPct: mergedPrev > 0 ? (mergedDeltaAbs / mergedPrev) * 100 : null,
        };
      } else {
        const deltaAbs = restThis - restPrev;
        topCats.push({
          category: otherLabel,
          thisPeriod: restThis,
          prevPeriod: restPrev,
          deltaAbs,
          deltaPct: restPrev > 0 ? (deltaAbs / restPrev) * 100 : null,
        });
      }
    }

    const categories: CategoryPoint[] = topCats;

    return {
      daily,
      categories,
      months,
      periodIncome,
      periodExpense,
      periodNet: periodIncome - periodExpense,
      prevPeriodIncome,
      prevPeriodExpense,
      prevPeriodNet: prevPeriodIncome - prevPeriodExpense,
      hasAny: hasAnyInRange,
    };
  }, [transactions, t, selectedRange]);

  const statRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 12,
    marginBottom: 16,
  };

  const statCardStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    background: 'linear-gradient(180deg, rgba(10,107,255,0.06) 0%, rgba(0,0,0,0) 100%)',
    minWidth: 0,
    overflow: 'hidden',
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--muted)',
    marginBottom: 6,
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: 'clamp(14px, 2.2vw, 16px)',
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const noDataStyle: React.CSSProperties = {
    padding: 40,
    textAlign: 'center',
    color: 'var(--muted)',
    background: 'linear-gradient(180deg, rgba(10,107,255,0.05) 0%, rgba(0,0,0,0) 100%)',
    borderRadius: 12,
    border: '1px dashed var(--border)',
  };

  const calculateDelta = (curr: number, prev: number) => {
    if (prev === 0) return { pct: null, abs: curr };
    return { pct: ((curr - prev) / prev) * 100, abs: curr - prev };
  };

  const incomeDelta = calculateDelta(analytics.periodIncome, analytics.prevPeriodIncome);
  const expenseDelta = calculateDelta(analytics.periodExpense, analytics.prevPeriodExpense);
  const netDelta = calculateDelta(analytics.periodNet, analytics.prevPeriodNet);

  const renderDelta = (delta: { pct: number | null, abs: number }, inverse = false) => {
    const isPositive = delta.abs > 0;
    const isNegative = delta.abs < 0;
    
    // For expense, positive delta is "bad" (red), negative is "good" (green)
    // For income/net, positive is "good" (green), negative is "bad" (red)
    const isGood = inverse ? isNegative : isPositive;
    
    const color = isGood ? 'var(--success)' : isNegative ? 'var(--danger)' : 'var(--muted)';
    const arrow = isPositive ? '↑' : isNegative ? '↓' : '';
    
    if (delta.abs === 0) return <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>;

    return (
      <span style={{ fontSize: 12, color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {arrow} {Math.abs(delta.pct ?? 0).toFixed(1)}%
      </span>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('graph.range')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([
            { key: '7d', label: t('graph.range_7d') },
            { key: '30d', label: t('graph.range_30d') },
            { key: '90d', label: t('graph.range_90d') },
            { key: 'ytd', label: t('graph.range_ytd') },
          ] as Array<{ key: TimeRange; label: string }>).map((opt) => (
            <button
              key={opt.key}
              className={`btn ${selectedRange === opt.key ? 'primary' : 'ghost'}`}
              onClick={() => setSelectedRange(opt.key)}
              aria-pressed={selectedRange === opt.key}
              style={{ padding: '6px 10px', fontSize: 12 }}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {!analytics.hasAny ? (
        <div style={noDataStyle}>{t('graph.no_data')}</div>
      ) : (
        <>
          <div style={statRowStyle}>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>{rangeLabel} · {t('graph.income')}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <div style={statValueStyle}>
                  <MoneyDisplay amount={analytics.periodIncome} />
                </div>
                {renderDelta(incomeDelta)}
              </div>
            </div>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>{rangeLabel} · {t('graph.expense')}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <div style={statValueStyle}>
                  <MoneyDisplay amount={analytics.periodExpense} />
                </div>
                {renderDelta(expenseDelta, true)}
              </div>
            </div>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>{rangeLabel} · {t('graph.net')}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <div style={statValueStyle}>
                  <MoneyDisplay amount={analytics.periodNet} colorize={true} />
                </div>
                {renderDelta(netDelta)}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>{t('graph.this_period')} · {t('graph.expense')}</div>
              <div style={statValueStyle}>
                <MoneyDisplay amount={analytics.periodExpense} />
              </div>
            </div>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>{t('graph.prev_period')} · {t('graph.expense')}</div>
              <div style={statValueStyle}>
                <MoneyDisplay amount={analytics.prevPeriodExpense} />
              </div>
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
                    <stop offset="5%" stopColor={incomeStroke} stopOpacity={areaFillOpacity}/>
                    <stop offset="95%" stopColor={incomeStroke} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={expenseStroke} stopOpacity={areaFillOpacity}/>
                    <stop offset="95%" stopColor={expenseStroke} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={gridOpacity} />
                <XAxis
                  dataKey="dateLabel"
                  stroke={axisStroke}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis
                  stroke={axisStroke}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₱${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                  dx={-5}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    color: tooltipText,
                    backdropFilter: 'blur(8px)',
                    borderRadius: '12px',
                    boxShadow: tooltipShadow,
                    border: `1px solid ${tooltipBorder}`
                  }}
                  itemStyle={{ fontSize: 13, fontWeight: 500 }}
                  labelStyle={{ color: tooltipLabelColor, marginBottom: 8, fontSize: 12 }}
                  cursor={{ stroke: cursorStroke, strokeWidth: 1, strokeDasharray: '4 4' }}
                  formatter={(value: any, name: any) => [formatMoney(Number(value)), name]}
                />
                <Legend content={(props: any) => {
                  const items = (props?.payload ?? []).filter(
                    (item: any) => item?.value === t('graph.income') || item?.value === t('graph.expense')
                  );
                  if (!items.length) return null;
                  return (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                        paddingTop: 10,
                        fontSize: 12,
                        color: 'var(--text)',
                      }}
                    >
                      {items.map((entry: any) => (
                        <div
                          key={entry.value}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: entry.color || 'var(--muted)',
                              flex: '0 0 auto',
                            }}
                          />
                          <span style={{ whiteSpace: 'nowrap' }}>{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }} />

                <Area
                  type="monotone"
                  dataKey="income"
                  name={t('graph.income')}
                  stroke={incomeStroke}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorIncome)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: incomeStroke, filter: `drop-shadow(0 0 8px ${incomeStroke})` }}
                  animationDuration={1200}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name={t('graph.expense')}
                  stroke={expenseStroke}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorExpense)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: expenseStroke, filter: `drop-shadow(0 0 8px ${expenseStroke})` }}
                  animationDuration={1200}
                />
                <Line
                  type="monotone"
                  dataKey="expenseAvg7"
                  name={t('graph.expense_avg_7d')}
                  stroke={avgStroke}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="hBox-wrappper">
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, flex: '2 1 400px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t('graph.expense_by_category')}</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={analytics.categories} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={6} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={gridOpacity} />
                    <XAxis dataKey="category" stroke={axisStroke} fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis stroke={axisStroke} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const row: any = payload[0]?.payload ?? {};
                        const thisPeriod = Number(row.thisPeriod ?? 0);
                        const prevPeriod = Number(row.prevPeriod ?? 0);
                        const deltaAbs = Number(row.deltaAbs ?? (thisPeriod - prevPeriod));
                        const deltaPct = typeof row.deltaPct === 'number' ? (row.deltaPct as number) : null;
                        const arrow = deltaAbs > 0 ? '▲' : deltaAbs < 0 ? '▼' : '—';
                        const deltaMoney = formatMoney(Math.abs(deltaAbs));
                        const changeText =
                          deltaAbs === 0
                            ? '—'
                            : `${arrow} ${deltaAbs > 0 ? '+' : '-'}${deltaMoney}${
                                deltaPct === null ? (prevPeriod <= 0 ? ' (new)' : '') : ` (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`
                              }`;

                        return (
                          <div
                            style={{
                              backgroundColor: tooltipBg,
                              borderColor: tooltipBorder,
                              color: tooltipText,
                              backdropFilter: 'blur(8px)',
                              borderRadius: '12px',
                              boxShadow: tooltipShadow,
                              border: `1px solid ${tooltipBorder}`,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{String(label ?? '')}</div>
                            <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <span style={{ color: tooltipLabelColor }}>{t('graph.this_period')}</span>
                                <span>{formatMoney(thisPeriod)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <span style={{ color: tooltipLabelColor }}>{t('graph.prev_period')}</span>
                                <span>{formatMoney(prevPeriod)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
                                <span style={{ color: tooltipLabelColor }}>{t('graph.change')}</span>
                                <span style={{ color: deltaAbs > 0 ? '#ff4d7d' : deltaAbs < 0 ? '#7bdcff' : 'var(--muted)' }}>{changeText}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 6, color: "var(--text)" }} iconType="circle" />
                    <Bar dataKey="thisPeriod" name={t('graph.this_period')} fill={categoryThisFill} radius={[8, 8, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="prevPeriod" name={t('graph.prev_period')} fill={categoryPrevFill} stroke={categoryPrevStroke} radius={[8, 8, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Monthly Trend moved below */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t('graph.monthly_trend')}</div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <ComposedChart data={analytics.months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={gridOpacity} />
                  <XAxis dataKey="monthLabel" stroke={axisStroke} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={axisStroke} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      color: tooltipText,
                      backdropFilter: 'blur(8px)',
                      borderRadius: '12px',
                      boxShadow: tooltipShadow,
                      border: `1px solid ${tooltipBorder}`
                    }}
                    formatter={(value: any, name: any) => [formatMoney(Number(value)), name]}
                  />
                  <Legend wrapperStyle={{ paddingTop: 6, color: "var(--text)" }} iconType="circle" />
                  <Bar dataKey="income" name={t('graph.income')} fill={monthIncomeFill} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expense" name={t('graph.expense')} fill={monthExpenseFill} radius={[8, 8, 0, 0]} />
                  <Line type="monotone" dataKey="net" name={t('graph.net')} stroke={netStroke} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
