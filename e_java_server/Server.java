import modules.server.ServerManager;
import modules.gui.Logger;

/**
 * Server - Main entry point for VeemahPay Transaction Server
 * Refactored to use modular architecture
 */
public class Server {
    
    public static void main(String[] args) {
        try {
            // Always launch GUI mode (as requested)
            ServerGUI.main(args);
        } catch (Exception e) {
            Logger.error("Failed to start server: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * Start server with GUI (legacy method - now redirects to ServerManager)
     */
    public static void startServerGUI() throws Exception {
        ServerManager.startServer();
    }
    
    /**
     * Stop server (legacy method - now redirects to ServerManager)
     */
    public static void stopServer() {
        ServerManager.stopServer();
    }
}