package com.bank;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.net.URI;

@SpringBootApplication
public class BankServerApplication {
    public static void main(String[] args) {
        configureDatasourceFromEnv();
        SpringApplication.run(BankServerApplication.class, args);
    }

    private static void configureDatasourceFromEnv() {
        String jdbcUrl = firstNonBlank(env("SPRING_DATASOURCE_URL"), env("JDBC_DATABASE_URL"));
        String username = firstNonBlank(env("SPRING_DATASOURCE_USERNAME"), env("DATABASE_USER"), env("PGUSER"));
        String password = firstNonBlank(env("SPRING_DATASOURCE_PASSWORD"), env("DATABASE_PASSWORD"), env("PGPASSWORD"));

        String databaseUrl = env("DATABASE_URL");
        if (isBlank(jdbcUrl) && !isBlank(databaseUrl)) {
            if (databaseUrl.startsWith("jdbc:")) {
                jdbcUrl = databaseUrl;
            } else if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
                ParsedDbUrl parsed = parsePostgresUrl(databaseUrl);
                jdbcUrl = parsed.jdbcUrl;
                if (isBlank(username) && !isBlank(parsed.username)) username = parsed.username;
                if (isBlank(password) && !isBlank(parsed.password)) password = parsed.password;
            } else {
                throw new IllegalArgumentException("DATABASE_URL must be jdbc:postgresql://... or postgres://...");
            }
        }

        if (isBlank(jdbcUrl)) {
            String host = env("PGHOST");
            String portRaw = env("PGPORT");
            String db = env("PGDATABASE");
            if (!isBlank(host) && !isBlank(db)) {
                int port = 5432;
                if (!isBlank(portRaw)) {
                    try {
                        port = Integer.parseInt(portRaw);
                    } catch (NumberFormatException ignored) {
                        port = 5432;
                    }
                }
                jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + db + "?sslmode=require";
            }
        }

        if (!isBlank(jdbcUrl)) {
            validateJdbcUrl(jdbcUrl);
            System.setProperty("spring.datasource.url", jdbcUrl);
        }
        if (!isBlank(username)) {
            System.setProperty("spring.datasource.username", username);
        }
        if (!isBlank(password)) {
            System.setProperty("spring.datasource.password", password);
        }
    }

    private static void validateJdbcUrl(String jdbcUrl) {
        if (jdbcUrl.contains("<") || jdbcUrl.contains(">")) {
            throw new IllegalArgumentException("Invalid datasource URL (contains placeholder brackets).");
        }
    }

    private static ParsedDbUrl parsePostgresUrl(String raw) {
        URI uri = URI.create(raw);
        String userInfo = uri.getUserInfo();
        String username = null;
        String password = null;
        if (!isBlank(userInfo)) {
            int idx = userInfo.indexOf(':');
            if (idx >= 0) {
                username = userInfo.substring(0, idx);
                password = userInfo.substring(idx + 1);
            } else {
                username = userInfo;
            }
        }

        String host = uri.getHost();
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        String path = uri.getPath();
        String db = (path == null) ? "" : path.replaceFirst("^/", "");
        if (isBlank(host) || isBlank(db)) {
            throw new IllegalArgumentException("Invalid postgres URL; expected postgres://user:pass@host:port/db");
        }

        String query = uri.getQuery();
        String jdbcQuery;
        if (isBlank(query)) {
            jdbcQuery = "sslmode=require";
        } else if (query.contains("sslmode=")) {
            jdbcQuery = query;
        } else {
            jdbcQuery = query + "&sslmode=require";
        }

        String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + db + "?" + jdbcQuery;
        return new ParsedDbUrl(jdbcUrl, username, password);
    }

    private static String env(String name) {
        String v = System.getenv(name);
        return v == null ? "" : v.trim();
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return "";
        for (String v : values) {
            if (!isBlank(v)) return v.trim();
        }
        return "";
    }

    private record ParsedDbUrl(String jdbcUrl, String username, String password) {}
}
