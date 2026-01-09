package modules.server;

import com.sun.net.httpserver.HttpServer;
import modules.gui.Logger;
import modules.utils.C;
import modules.database.DatabaseManager;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.sql.SQLException;
import java.util.concurrent.Executors;

/**
 * ServerManager - Handles HTTP server operations
 * Extracted from Server.java for better modularity
 */
public class ServerManager {
    private static final int PORT = 8081;
    private static HttpServer httpServer;
    
    /**
     * Start the HTTP server
     */
    public static void startServer() throws IOException, SQLException {
        Logger.log("[SERVER] Initializing VeemahPay Transaction Server...", C.N.MAGENTA);
        
        // Initialize database connection
        DatabaseManager.initializeDatabase();
        
        // Create HTTP server
        startHttpServer();
    }
    
    /**
     * Start HTTP server with logging
     */
    private static void startHttpServer() throws IOException {
        // Create HTTP server
        httpServer = HttpServer.create(new InetSocketAddress("0.0.0.0", PORT), 0);

        Logger.log("================================================", C.N.BLUE);
        Logger.log("VeemahPay Transaction Server STARTED", C.N.GREEN);
        Logger.log("Listening on Port: " + PORT, C.N.YELLOW);
        Logger.log("Database: Connected to Neon PostgreSQL", C.N.GREEN);
        Logger.log("Test locally: http://localhost:" + PORT + "/api/transactions", C.N.YELLOW);
        
        String tunnelDomain = System.getenv("JAVA_TRANSACTION_API");
        if (tunnelDomain != null) {
            Logger.log("Tunnel: " + tunnelDomain, C.N.YELLOW);
        } else {
            Logger.log("Tunnel: Set JAVA_TRANSACTION_API environment variable for tunnel access", C.N.RED);
        }
        Logger.log("================================================", C.N.BLUE);

        // Register API endpoints
        httpServer.createContext("/api/transactions", new TransactionHandler());
        httpServer.createContext("/health", new HealthCheckHandler());
        
        Logger.log("[SERVER] Registered API endpoints: /api/transactions, /health", C.N.CYAN);
        
        // Set thread pool executor
        httpServer.setExecutor(Executors.newFixedThreadPool(10));
        
        // Start the server
        httpServer.start();
        Logger.log("[SERVER] HTTP server started successfully on port " + PORT, C.N.GREEN);
    }
    
    /**
     * Stop the HTTP server
     */
    public static void stopServer() {
        if (httpServer != null) {
            Logger.log("Shutting down server...", C.N.YELLOW);
            httpServer.stop(0);
            httpServer = null;
        }
        
        DatabaseManager.closeConnection();
    }
    
    /**
     * Check if server is running
     */
    public static boolean isServerRunning() {
        return httpServer != null;
    }
    
    /**
     * Get server port
     */
    public static int getPort() {
        return PORT;
    }
}