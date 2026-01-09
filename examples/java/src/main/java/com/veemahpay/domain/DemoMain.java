package com.veemahpay.domain;

import java.math.BigDecimal;

public final class DemoMain {
  public static void main(String[] args) {
    Account alice = new SavingsAccount(
      "1001",
      "Alice Dela Cruz",
      Money.of(new BigDecimal("5000.00")),
      Account.Status.Active
    );

    Account bob = new CheckingAccount(
      "2002",
      "Bob Santos",
      Money.of(new BigDecimal("500.00")),
      Account.Status.Active,
      Money.of(new BigDecimal("1000.00"))
    );

    System.out.println("Initial");
    printAccount(alice);
    printAccount(bob);

    System.out.println("\nDeposit 250.00 to Alice");
    alice.deposit(Money.of(new BigDecimal("250.00")));
    printAccount(alice);

    System.out.println("\nTransfer 1200.00 from Alice to Bob");
    alice.transfer(bob, Money.of(new BigDecimal("1200.00")));
    printAccount(alice);
    printAccount(bob);

    System.out.println("\nTry withdrawing 2000.00 from Bob (overdraft allowed up to 1000.00)");
    try {
      bob.withdraw(Money.of(new BigDecimal("2000.00")));
      System.out.println("Withdraw succeeded");
    } catch (RuntimeException e) {
      System.out.println("Withdraw failed: " + e.getMessage());
    }
    printAccount(bob);

    System.out.println("\nAccrue 5% interest to Alice savings");
    ((SavingsAccount) alice).accrueInterest(new BigDecimal("0.05"));
    printAccount(alice);

    System.out.println("\nLock Alice, then try deposit (should fail)");
    alice.setStatus(Account.Status.Locked);
    try {
      alice.deposit(Money.of(new BigDecimal("10.00")));
      System.out.println("Deposit succeeded");
    } catch (RuntimeException e) {
      System.out.println("Deposit failed: " + e.getMessage());
    }
    printAccount(alice);
  }

  private static void printAccount(Account acc) {
    System.out.println(
      acc.getNumber() + " | " + acc.getName() + " | " + acc.getStatus() + " | balance=" + acc.getBalance()
    );
  }
}
