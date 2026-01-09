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
    private static final String DATABASE_URL = "postgresql://neondb_owner:npg_nrs02GPJjDlu@ep-calm-boat-a1stz2a7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
    
    private static Connection dbConnection;
    
    public static void main(String[] args) throws IOException, SQLException {
        // Initialize database connection
        initializeDatabase();
        
        // Create HTTP server
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", PORT), 0);
        
        System.out.println("================================================");
        System.out.println("VeemahPay Transaction Server STARTED");
        System.out.println("Listening on Port: " + PORT);
        System.out.println("Database: Connected to Neon PostgreSQL");
        System.out.println("Test locally: http://localhost:" + PORT + "/api/transactions");
        System.out.println("Tunnel: sasha-nonreliable-thunderingly.ngrok-free.dev");
        System.out.println("================================================");

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
            
            System.out.println("✓ PostgreSQL driver loaded");
            
            // Create connection with proper connection string
            Properties props = new Properties();
            props.setProperty("user", "neondb_owner");
            props.setProperty("password", "npg_nrs02GPJjDlu");
            props.setProperty("ssl", "true");
            props.setProperty("sslmode", "require");
            
            String url = "jdbc:postgresql://ep-calm-boat-a1stz2a7-pooler.ap-southeast-1.aws.neon.tech/neondb";
            dbConnection = DriverManager.getConnection(url, props);
            
            // Test connection
            try (Statement stmt = dbConnection.createStatement()) {
                ResultSet rs = stmt.executeQuery("SELECT 1");
                if (rs.next()) {
                    System.out.println("✓ Database connection successful");
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