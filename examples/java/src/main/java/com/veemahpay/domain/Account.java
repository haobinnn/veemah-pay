package com.veemahpay.domain;

import java.util.Objects;

public abstract class Account {
  public enum Status { Active, Locked, Archived }

  private final String number;
  private String name;
  private Money balance;
  private Status status;

  public Account(String number, String name, Money balance, Status status) {
    this.number = Objects.requireNonNull(number);
    this.name = Objects.requireNonNull(name);
    this.balance = Objects.requireNonNull(balance);
    this.status = Objects.requireNonNull(status);
    if (this.balance.isNegative()) throw new IllegalArgumentException("negative balance");
  }

  public String getNumber() { return number; }
  public String getName() { return name; }
  public Money getBalance() { return balance; }
  public Status getStatus() { return status; }

  public void setName(String name) { this.name = Objects.requireNonNull(name); }
  public void setStatus(Status status) { this.status = Objects.requireNonNull(status); }

  public void deposit(Money amount) {
    requireActive();
    requirePositive(amount);
    balance = balance.add(amount);
  }

  public void withdraw(Money amount) {
    requireActive();
    requirePositive(amount);
    if (balance.compareTo(amount) < 0) throw new IllegalStateException("insufficient funds");
    balance = balance.subtract(amount);
  }

  public void transfer(Account target, Money amount) {
    requireActive();
    Objects.requireNonNull(target);
    if (target.status != Status.Active) throw new IllegalStateException("target unavailable");
    requirePositive(amount);
    if (balance.compareTo(amount) < 0) throw new IllegalStateException("insufficient funds");
    balance = balance.subtract(amount);
    target.balance = target.balance.add(amount);
  }

  protected void requireActive() {
    if (status != Status.Active) throw new IllegalStateException("account unavailable");
  }

  protected void requirePositive(Money amount) {
    if (amount == null || amount.isNegative() || amount.compareTo(Money.zero()) == 0) throw new IllegalArgumentException("amount must be positive");
  }

  protected void setBalance(Money newBalance) { this.balance = Objects.requireNonNull(newBalance); }
}
