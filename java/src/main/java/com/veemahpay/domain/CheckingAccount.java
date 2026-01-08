package com.veemahpay.domain;

import java.util.Objects;

public final class CheckingAccount extends Account {
  private final Money overdraftLimit;

  public CheckingAccount(String number, String name, Money balance, Status status, Money overdraftLimit) {
    super(number, name, balance, status);
    this.overdraftLimit = Objects.requireNonNull(overdraftLimit);
  }

  @Override
  public void withdraw(Money amount) {
    requireActive();
    requirePositive(amount);
    Money newBalance = getBalance().subtract(amount);
    Money lowerBound = overdraftLimit.negate();
    if (newBalance.compareTo(lowerBound) < 0) throw new IllegalStateException("insufficient funds");
    setBalance(newBalance);
  }

  @Override
  public void transfer(Account target, Money amount) {
    requireActive();
    Objects.requireNonNull(target);
    if (target.getStatus() != Status.Active) throw new IllegalStateException("target unavailable");
    requirePositive(amount);
    Money newBalance = getBalance().subtract(amount);
    Money lowerBound = overdraftLimit.negate();
    if (newBalance.compareTo(lowerBound) < 0) throw new IllegalStateException("insufficient funds");
    setBalance(newBalance);
    target.deposit(amount);
  }
}
