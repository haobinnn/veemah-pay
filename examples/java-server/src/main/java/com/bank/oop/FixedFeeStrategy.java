package com.bank.oop;

import java.math.BigDecimal;

public class FixedFeeStrategy implements TransactionFeeStrategy {
    private final BigDecimal fee;

    public FixedFeeStrategy(BigDecimal fee) {
        this.fee = fee;
    }

    @Override
    public BigDecimal calculateFee(BigDecimal amount) {
        return fee;
    }
}