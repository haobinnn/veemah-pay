package modules.server;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import modules.database.DatabaseManager;
import java.io.IOException;
import java.io.OutputStream;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * HealthCheckHandler - Handles health check endpoint
 * Extracted from Server.java for better modularity
 */
public class HealthCheckHandler implements HttpHandler {
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
            try (Statement stmt = DatabaseManager.getConnection().createStatement()) {
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
    
    /**
     * Helper method to set CORS headers
     */
    private void setCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", 
            "Content-Type, Authorization, ngrok-skip-browser-warning, Accept");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "3600");
    }
}