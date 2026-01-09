package com.bank.oop;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

public class TransactionFeePolicy {
    private final Map<String, TransactionFeeStrategy> strategies = new HashMap<>();

    public TransactionFeePolicy() {
        strategies.put("deposit", new ZeroFeeStrategy());
        strategies.put("withdraw", new FixedFeeStrategy(new BigDecimal("2.00")));
        strategies.put("transfer", new PercentageFeeStrategy(new BigDecimal("0.005")));
        strategies.put("fee", new ZeroFeeStrategy());
    }

    public BigDecimal computeFee(String type, BigDecimal amount) {
        if (type == null) return BigDecimal.ZERO;
        TransactionFeeStrategy strategy = strategies.get(type.toLowerCase());
        if (strategy == null) strategy = new ZeroFeeStrategy();
        return strategy.calculateFee(amount);
    }
}