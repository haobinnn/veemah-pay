package com.bank.oop;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class PercentageFeeStrategy implements TransactionFeeStrategy {
    private final BigDecimal percent;

    public PercentageFeeStrategy(BigDecimal percent) {
        this.percent = percent;
    }

    @Override
    public BigDecimal calculateFee(BigDecimal amount) {
        if (amount == null) return BigDecimal.ZERO;
        BigDecimal fee = amount.multiply(percent);
        return fee.setScale(2, RoundingMode.HALF_UP);
    }
}