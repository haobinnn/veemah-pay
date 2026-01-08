package com.veemahpay.domain;

import java.math.BigDecimal;
import java.util.Objects;

public final class SavingsAccount extends Account {
  public SavingsAccount(String number, String name, Money balance, Status status) {
    super(number, name, balance, status);
  }

  public void accrueInterest(BigDecimal rate) {
    requireActive();
    Objects.requireNonNull(rate);
    if (rate.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("rate must be positive");
    Money interest = getBalance().multiply(rate);
    setBalance(getBalance().add(interest));
  }
}
