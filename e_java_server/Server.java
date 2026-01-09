import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.sql.*;
import java.util.Properties;
import java.util.concurrent.Executors;

public class Server {
    private static final int PORT = 8081; // Changed from 8080 to avoid conflict
    private static String DATABASE_URL;
    
    private static Connection dbConnection;
    
    public static void main(String[] args) throws IOException, SQLException {
        // Initialize database connection
        initializeDatabase();
        
        // Create HTTP server
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", PORT), 0);

        C.println("================================================", C.N.BLUE);
        C.println("VeemahPay Transaction Server STARTED", C.N.GREEN);
        C.println("Listening on Port: " + PORT, C.N.YELLOW);
        C.println("Database: Connected to Neon PostgreSQL", C.N.GREEN);
        C.println("Test locally: http://localhost:" + PORT + "/api/transactions", C.N.YELLOW);
        String tunnelDomain = System.getenv("JAVA_TRANSACTION_API");
        if (tunnelDomain != null) {
            C.println("Tunnel: " + tunnelDomain, C.N.YELLOW);
        } else {
            C.println("Tunnel: Set JAVA_TRANSACTION_API environment variable for tunnel access", C.N.RED);
        }
        C.println("================================================", C.N.BLUE);

        // Register API endpoints
        server.createContext("/api/transactions", new TransactionHandler());
        server.createContext("/health", new HealthCheckHandler());
        
        // Set thread pool executor
        server.setExecutor(Executors.newFixedThreadPool(10));
        server.start();
    }
    
    private static void initializeDatabase() throws SQLException {
        try {
            // Load PostgreSQL driver
            Class.forName("org.postgresql.Driver");

            C.println("PostgreSQL driver loaded", C.N.GREEN);

            // Get database URL from environment variable
            String databaseUrl = System.getenv("DATABASE_URL");
            if (databaseUrl == null) {
                throw new RuntimeException("DATABASE_URL environment variable not set");
            }

            // Remove surrounding quotes if present
            databaseUrl = databaseUrl.replaceAll("^'|'$", "");
            
            // Parse DATABASE_URL to extract connection details securely
            String cleanUrl = databaseUrl.replace("postgresql://", "");
            String[] parts = cleanUrl.split("@");
            if (parts.length != 2) {
                throw new RuntimeException("Invalid DATABASE_URL format");
            }
            
            String[] credentials = parts[0].split(":");
            if (credentials.length != 2) {
                throw new RuntimeException("Invalid DATABASE_URL credentials format");
            }
            
            String username = credentials[0];
            String password = credentials[1];
            String[] hostDb = parts[1].split("/");
            String host = hostDb[0];
            String database = hostDb[1].split("\\?")[0];
            
            String jdbcUrl = "jdbc:postgresql://" + host + "/" + database;
            
            Properties props = new Properties();
            props.setProperty("user", username);
            props.setProperty("password", password);
            props.setProperty("ssl", "true");
            props.setProperty("sslmode", "require");

            // DEBUG: Print the actual loaded driver version
Driver driver = DriverManager.getDriver("jdbc:postgresql:");
C.println("DEBUG: Loaded Driver Version: " + driver.getMajorVersion() + "." + driver.getMinorVersion(), C.N.YELLOW);

            dbConnection = DriverManager.getConnection(jdbcUrl, props);
            
            // Test connection
            try (Statement stmt = dbConnection.createStatement()) {
                ResultSet rs = stmt.executeQuery("SELECT 1");
                if (rs.next()) {
                    C.println("Database connection successful", C.N.GREEN);
                } else {
                    C.println("Database connection failed", C.N.RED);
                }
            }
            
        } catch (ClassNotFoundException e) {
            throw new SQLException("PostgreSQL driver not found. Please add postgresql jar to classpath.", e);
        }
    }
    
    public static Connection getConnection() {
        return dbConnection;
    }
    
    // Health check endpoint
    static class HealthCheckHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Set CORS headers for all requests
            setCorsHeaders(exchange);
            
            // Handle preflight OPTIONS request
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            
            try {
                // Check database connectivity
                try (Statement stmt = dbConnection.createStatement()) {
                    stmt.executeQuery("SELECT 1");
                }
                
                String response = "{\n" +
                    "  \"status\": \"healthy\",\n" +
                    "  \"service\": \"VeemahPay Transaction API\",\n" +
                    "  \"database\": \"connected\",\n" +
                    "  \"timestamp\": \"" + new java.util.Date() + "\"\n" +
                    "}";
                
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, response.length());
                
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes());
                os.close();
                
            } catch (SQLException e) {
                String errorResponse = "{\"status\": \"unhealthy\", \"error\": \"Database connection failed\"}";
                exchange.sendResponseHeaders(500, errorResponse.length());
                OutputStream os = exchange.getResponseBody();
                os.write(errorResponse.getBytes());
                os.close();
            }
        }
    }
    
    // Helper method to set CORS headers
    private static void setCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", 
            "Content-Type, Authorization, ngrok-skip-browser-warning, Accept");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "3600");
    }
}