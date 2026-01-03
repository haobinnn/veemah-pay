"use client";
import React from 'react';

interface MoneyDisplayProps {
  amount: number;
  currency?: string;
  showSign?: boolean;
  colorize?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function MoneyDisplay({ 
  amount, 
  currency = "₱", 
  showSign = false, 
  colorize = false, 
  className = "", 
  style = {} 
}: MoneyDisplayProps) {
  // Format number with commas
  const formatNumber = (num: number): string => {
    return Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Determine sign and color
  const isPositive = amount > 0;
  const isNegative = amount < 0;
  const isZero = amount === 0;

  // Build the display string
  let displayText = "";
  if (showSign && !isZero) {
    displayText = isPositive ? "+" : "-";
  } else if (isNegative && !showSign) {
    displayText = "-";
  }
  displayText += currency + formatNumber(amount);

  // Determine colors
  let color = style.color || undefined;
  if (colorize) {
    if (isPositive) {
      color = '#4caf50'; // Green for positive
    } else if (isNegative) {
      color = '#f44336'; // Red for negative
    } else {
      color = '#757575'; // Gray for zero
    }
  }

  // Combine styles
  const combinedStyle: React.CSSProperties = {
    ...style,
    color,
    fontWeight: style.fontWeight || 'bold',
    fontVariantNumeric: 'tabular-nums', // Monospace numbers for better alignment
  };

  return (
    <span className={`money-display ${className}`.trim()} style={combinedStyle}>
      {displayText}
    </span>
  );
}

// Convenience components for common use cases
export function PositiveMoney({ amount, currency, className, style }: Omit<MoneyDisplayProps, 'showSign' | 'colorize'>) {
  return (
    <MoneyDisplay 
      amount={amount} 
      currency={currency} 
      showSign={true} 
      colorize={true} 
      className={className} 
      style={style} 
    />
  );
}

export function ColorizedMoney({ amount, currency, className, style }: Omit<MoneyDisplayProps, 'colorize'>) {
  return (
    <MoneyDisplay 
      amount={amount} 
      currency={currency} 
      colorize={true} 
      className={className} 
      style={style} 
    />
  );
}

export function FormattedMoney({ amount, currency, className, style }: Omit<MoneyDisplayProps, 'showSign' | 'colorize'>) {
  return (
    <MoneyDisplay 
      amount={amount} 
      currency={currency} 
      showSign={false} 
      colorize={false} 
      className={className} 
      style={style} 
    />
  );
}