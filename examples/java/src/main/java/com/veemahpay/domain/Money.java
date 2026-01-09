package com.veemahpay.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

public final class Money implements Comparable<Money> {
  private final BigDecimal amount;

  private Money(BigDecimal amount) {
    this.amount = amount.setScale(2, RoundingMode.HALF_UP);
  }

  public static Money of(BigDecimal amount) {
    return new Money(Objects.requireNonNull(amount));
  }

  public static Money zero() { return new Money(BigDecimal.ZERO); }

  public BigDecimal asBigDecimal() { return amount; }

  public Money add(Money other) { return new Money(this.amount.add(other.amount)); }
  public Money subtract(Money other) { return new Money(this.amount.subtract(other.amount)); }
  public Money multiply(int factor) { return new Money(this.amount.multiply(BigDecimal.valueOf(factor))); }
  public Money multiply(BigDecimal factor) { return new Money(this.amount.multiply(factor)); }
  public Money negate() { return new Money(this.amount.negate()); }

  public boolean isNegative() { return amount.signum() < 0; }

  @Override
  public int compareTo(Money other) { return this.amount.compareTo(other.amount); }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Money)) return false;
    Money money = (Money) o;
    return amount.compareTo(money.amount) == 0;
  }

  @Override
  public int hashCode() { return amount.stripTrailingZeros().hashCode(); }

  @Override
  public String toString() { return amount.toPlainString(); }
}
