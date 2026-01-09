package modules.gui;

import modules.utils.C;

/**
 * Logger - Centralized logging utility
 * Can output to GUI or console depending on availability
 */
public class Logger {
    private static Object guiInstance; // Use Object to avoid circular dependency
    
    /**
     * Set the GUI instance for logging
     */
    public static void setGuiInstance(Object gui) {
        guiInstance = gui;
    }
    
    /**
     * Log a message with color
     * Routes to GUI if available, otherwise to console
     */
    public static void log(String message, C.N color) {
        if (guiInstance != null) {
            // Use reflection to call appendLog method
            try {
                guiInstance.getClass().getMethod("appendLog", String.class, C.N.class)
                    .invoke(guiInstance, message, color);
            } catch (Exception e) {
                // Fallback to console if reflection fails
                C.println(message, color);
            }
        } else {
            // Fallback to console if GUI not available
            C.println(message, color);
        }
    }
    
    /**
     * Log info message (default color)
     */
    public static void info(String message) {
        log(message, C.N.WHITE);
    }
    
    /**
     * Log error message (red color)
     */
    public static void error(String message) {
        log(message, C.N.RED);
    }
    
    /**
     * Log success message (green color)
     */
    public static void success(String message) {
        log(message, C.N.GREEN);
    }
    
    /**
     * Log warning message (yellow color)
     */
    public static void warning(String message) {
        log(message, C.N.YELLOW);
    }
}