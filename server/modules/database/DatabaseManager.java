package modules.database;

import modules.gui.Logger;
import modules.utils.C;
import java.sql.*;
import java.util.Properties;

/**
 * DatabaseManager - Handles all database operations and connections
 * Extracted from Server.java for better modularity
 */
public class DatabaseManager {
    private static Connection dbConnection;
    
    /**
     * Initialize database connection with environment variables
     */
    public static void initializeDatabase() throws SQLException {
        try {
            // Load PostgreSQL driver
            Class.forName("org.postgresql.Driver");
            Logger.log("PostgreSQL driver loaded", C.N.GREEN);

            // Get database URL from environment variable
            String databaseUrl = System.getenv("DATABASE_URL");
            if (databaseUrl == null) {
                throw new RuntimeException("DATABASE_URL environment variable not set");
            }

            // Remove any surrounding quotes from the entire URL
            databaseUrl = databaseUrl.trim();
            if (databaseUrl.startsWith("'") && databaseUrl.endsWith("'")) {
                databaseUrl = databaseUrl.substring(1, databaseUrl.length() - 1);
            }
            if (databaseUrl.startsWith("\"") && databaseUrl.endsWith("\"")) {
                databaseUrl = databaseUrl.substring(1, databaseUrl.length() - 1);
            }

            // Parse the DATABASE_URL to extract components
            // Format: postgres://username:password@host:port/database
            databaseUrl = databaseUrl.replace("postgres://", "").replace("postgresql://", "");
            
            // Split by @ to separate credentials from host
            String[] urlParts = databaseUrl.split("@");
            if (urlParts.length != 2) {
                throw new RuntimeException("Invalid DATABASE_URL format. Expected: postgres://username:password@host:port/database");
            }
            
            // Parse credentials and remove any quotes
            String[] userPass = urlParts[0].split(":");
            if (userPass.length != 2) {
                throw new RuntimeException("Invalid DATABASE_URL credentials format. Expected: username:password");
            }
            String username = userPass[0].trim().replaceAll("^['\"]|['\"]$", "");
            String password = userPass[1].trim().replaceAll("^['\"]|['\"]$", "");
            
            // Parse host and database
            String[] hostDb = urlParts[1].split("/");
            if (hostDb.length < 2) {
                throw new RuntimeException("Invalid DATABASE_URL host/database format. Expected: host:port/database");
            }
            
            String[] hostPort = hostDb[0].split(":");
            String host = hostPort[0];
            String port = hostPort.length > 1 ? hostPort[1] : "5432";
            String database = hostDb[1].split("\\?")[0]; // Remove query parameters if present
            
            Logger.log("Connecting to database: " + host + ":" + port + "/" + database + " as user: " + username, C.N.YELLOW);

            // Construct JDBC URL
            String jdbcUrl = String.format("jdbc:postgresql://%s:%s/%s", host, port, database);

            // Set connection properties
            Properties props = new Properties();
            props.setProperty("user", username);
            props.setProperty("password", password);
            props.setProperty("sslmode", "require");

            // DEBUG: Print the actual loaded driver version
            Driver driver = DriverManager.getDriver("jdbc:postgresql:");
            Logger.log("DEBUG: Loaded Driver Version: " + driver.getMajorVersion() + "." + driver.getMinorVersion(), C.N.YELLOW);

            dbConnection = DriverManager.getConnection(jdbcUrl, props);
            
            // Test connection
            testConnection();
            
        } catch (ClassNotFoundException e) {
            throw new SQLException("PostgreSQL driver not found. Please add postgresql jar to classpath.", e);
        }
    }
    
    /**
     * Test database connection
     */
    private static void testConnection() throws SQLException {
        try (Statement stmt = dbConnection.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT 1");
            if (rs.next()) {
                Logger.log("Database connection successful", C.N.GREEN);
            } else {
                Logger.log("Database connection failed", C.N.RED);
            }
        }
    }
    
    /**
     * Get the current database connection
     */
    public static Connection getConnection() {
        return dbConnection;
    }
    
    /**
     * Check if database is connected
     */
    public static boolean isConnected() {
        try {
            return dbConnection != null && !dbConnection.isClosed();
        } catch (SQLException e) {
            return false;
        }
    }
    
    /**
     * Close database connection
     */
    public static void closeConnection() {
        if (dbConnection != null) {
            try {
                dbConnection.close();
                Logger.log("Database connection closed", C.N.GREEN);
            } catch (SQLException e) {
                Logger.log("Error closing database connection: " + e.getMessage(), C.N.RED);
            }
        }
    }
}