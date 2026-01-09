package com.bank.oop;

import java.math.BigDecimal;

public interface TransactionFeeStrategy {
    BigDecimal calculateFee(BigDecimal amount);
}