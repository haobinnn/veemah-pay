package com.veemahpay.domain;

import java.util.Objects;

public final class StudentAccount extends Account {
  private final Money perTransactionLimit;

  public StudentAccount(String number, String name, Money balance, Status status, Money perTransactionLimit) {
    super(number, name, balance, status);
    this.perTransactionLimit = Objects.requireNonNull(perTransactionLimit);
  }

  @Override
  public void withdraw(Money amount) {
    requireActive();
    requirePositive(amount);
    if (amount.compareTo(perTransactionLimit) > 0) throw new IllegalArgumentException("limit exceeded");
    super.withdraw(amount);
  }

  @Override
  public void transfer(Account target, Money amount) {
    requireActive();
    Objects.requireNonNull(target);
    if (target.getStatus() != Status.Active) throw new IllegalStateException("target unavailable");
    requirePositive(amount);
    if (amount.compareTo(perTransactionLimit) > 0) throw new IllegalArgumentException("limit exceeded");
    super.transfer(target, amount);
  }
}
