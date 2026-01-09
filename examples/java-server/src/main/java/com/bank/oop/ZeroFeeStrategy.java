package com.bank.oop;

import java.math.BigDecimal;

public class ZeroFeeStrategy implements TransactionFeeStrategy {
    @Override
    public BigDecimal calculateFee(BigDecimal amount) {
        return BigDecimal.ZERO;
    }
}