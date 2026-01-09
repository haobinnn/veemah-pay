import javax.swing.*;
import javax.swing.text.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import modules.server.ServerManager;
import modules.gui.Logger;
import modules.utils.C;
import modules.database.DatabaseManager;

public class ServerGUI extends JFrame {
    private JTextPane logArea;
    private StyledDocument doc;
    private JButton startButton;
    private JButton stopButton;
    private JButton clearButton;
    private JButton refreshButton;
    private JLabel statusLabel;
    private JLabel connectionLabel;
    private JLabel portLabel;
    private JProgressBar connectionProgress;
    
    // Color styles for different log levels
    private Style redStyle;
    private Style greenStyle;
    private Style yellowStyle;
    private Style blueStyle;
    private Style defaultStyle;
    
    private boolean serverRunning = false;
    
    // Static reference for direct logging from other classes
    private static ServerGUI instance;
    
    public ServerGUI() {
        instance = this;  // Set static reference
        Logger.setGuiInstance(this);  // Register with Logger
        initializeGUI();
        setupStyles();
        // Remove redirectSystemOut() - we'll use direct logging instead
    }
    
    private void initializeGUI() {
        setTitle("VeemahPay Transaction Server - Management Console");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLayout(new BorderLayout());
        
        // Create main panels
        JPanel topPanel = createTopPanel();
        JPanel centerPanel = createCenterPanel();
        JPanel bottomPanel = createBottomPanel();
        
        add(topPanel, BorderLayout.NORTH);
        add(centerPanel, BorderLayout.CENTER);
        add(bottomPanel, BorderLayout.SOUTH);
        
        // Set window properties
        setSize(1000, 700);
        setLocationRelativeTo(null);
        
        // Set icon (if available)
        try {
            // You can add an icon here if you have one
            // setIconImage(ImageIO.read(new File("icon.png")));
        } catch (Exception e) {
            // Icon not found, continue without it
        }
    }
    
    private JPanel createTopPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 5, 10));
        
        // Title panel
        JPanel titlePanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
        JLabel titleLabel = new JLabel("VeemahPay Transaction Server Console");
        titleLabel.setFont(new Font("Arial", Font.BOLD, 18));
        titleLabel.setForeground(new Color(0, 102, 204));
        titlePanel.add(titleLabel);
        
        // Status panel
        JPanel statusPanel = new JPanel(new GridLayout(3, 2, 10, 5));
        statusPanel.setBorder(BorderFactory.createTitledBorder("Server Status"));
        
        statusPanel.add(new JLabel("Status:"));
        statusLabel = new JLabel("X Stopped");
        statusLabel.setForeground(Color.RED);
        statusPanel.add(statusLabel);
        
        statusPanel.add(new JLabel("Port:"));
        portLabel = new JLabel("8081");
        statusPanel.add(portLabel);
        
        statusPanel.add(new JLabel("Database:"));
        connectionLabel = new JLabel("X Disconnected");
        connectionLabel.setForeground(Color.RED);
        statusPanel.add(connectionLabel);
        
        // Connection progress
        connectionProgress = new JProgressBar();
        connectionProgress.setStringPainted(true);
        connectionProgress.setString("Ready to connect...");
        
        panel.add(titlePanel, BorderLayout.NORTH);
        panel.add(statusPanel, BorderLayout.CENTER);
        panel.add(connectionProgress, BorderLayout.SOUTH);
        
        return panel;
    }
    
    private JPanel createCenterPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createTitledBorder("Server Logs"));
        
        // Create log text pane with styling support
        logArea = new JTextPane();
        logArea.setEditable(false);
        logArea.setBackground(new Color(248, 248, 248));
        logArea.setFont(new Font("Consolas", Font.PLAIN, 12));
        doc = logArea.getStyledDocument();
        
        // Add to scroll pane
        JScrollPane scrollPane = new JScrollPane(logArea);
        scrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);
        scrollPane.setPreferredSize(new Dimension(950, 400));
        
        panel.add(scrollPane, BorderLayout.CENTER);
        
        return panel;
    }
    
    private JPanel createBottomPanel() {
        JPanel panel = new JPanel(new FlowLayout(FlowLayout.CENTER, 10, 10));
        panel.setBorder(BorderFactory.createEtchedBorder());
        
        // Control buttons
        startButton = new JButton("Start Server");
        startButton.setBackground(new Color(76, 175, 80));
        startButton.setForeground(Color.WHITE);
        startButton.setPreferredSize(new Dimension(130, 35));
        
        stopButton = new JButton("Stop Server");
        stopButton.setBackground(new Color(244, 67, 54));
        stopButton.setForeground(Color.WHITE);
        stopButton.setPreferredSize(new Dimension(130, 35));
        stopButton.setEnabled(false);
        
        refreshButton = new JButton("Refresh Status");
        refreshButton.setBackground(new Color(33, 150, 243));
        refreshButton.setForeground(Color.WHITE);
        refreshButton.setPreferredSize(new Dimension(130, 35));
        
        clearButton = new JButton("Clear Logs");
        clearButton.setBackground(new Color(158, 158, 158));
        clearButton.setForeground(Color.WHITE);
        clearButton.setPreferredSize(new Dimension(130, 35));
        
        // Add action listeners
        startButton.addActionListener(e -> startServer());
        stopButton.addActionListener(e -> stopServer());
        refreshButton.addActionListener(e -> refreshStatus());
        clearButton.addActionListener(e -> clearLogs());
        
        panel.add(startButton);
        panel.add(stopButton);
        panel.add(refreshButton);
        panel.add(clearButton);
        
        return panel;
    }
    
    private void setupStyles() {
        // Create different color styles
        redStyle = doc.addStyle("red", null);
        StyleConstants.setForeground(redStyle, new Color(220, 53, 69));
        StyleConstants.setBold(redStyle, true);
        
        greenStyle = doc.addStyle("green", null);
        StyleConstants.setForeground(greenStyle, new Color(40, 167, 69));
        StyleConstants.setBold(greenStyle, true);
        
        yellowStyle = doc.addStyle("yellow", null);
        StyleConstants.setForeground(yellowStyle, new Color(255, 193, 7));
        StyleConstants.setBold(yellowStyle, true);
        
        blueStyle = doc.addStyle("blue", null);
        StyleConstants.setForeground(blueStyle, new Color(0, 123, 255));
        StyleConstants.setBold(blueStyle, true);
        
        defaultStyle = doc.addStyle("default", null);
        StyleConstants.setForeground(defaultStyle, Color.BLACK);
    }
    
    private void redirectSystemOut() {
        // Custom OutputStream that writes to our GUI
        OutputStream out = new OutputStream() {
            @Override
            public void write(int b) throws IOException {
                SwingUtilities.invokeLater(() -> {
                    try {
                        doc.insertString(doc.getLength(), String.valueOf((char) b), defaultStyle);
                        logArea.setCaretPosition(doc.getLength());
                    } catch (BadLocationException e) {
                        e.printStackTrace();
                    }
                });
            }
            
            @Override
            public void write(byte[] b, int off, int len) throws IOException {
                SwingUtilities.invokeLater(() -> {
                    try {
                        String text = new String(b, off, len);
                        doc.insertString(doc.getLength(), text, defaultStyle);
                        logArea.setCaretPosition(doc.getLength());
                    } catch (BadLocationException e) {
                        e.printStackTrace();
                    }
                });
            }
        };
        
        System.setOut(new PrintStream(out, true));
    }
    
    public void appendLog(String message, C.N color) {
        SwingUtilities.invokeLater(() -> {
            try {
                Style style;
                switch (color) {
                    case RED: style = redStyle; break;
                    case GREEN: style = greenStyle; break;
                    case YELLOW: style = yellowStyle; break;
                    case BLUE: style = blueStyle; break;
                    default: style = defaultStyle; break;
                }
                
                String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
                doc.insertString(doc.getLength(), "[" + timestamp + "] " + message + "\n", style);
                logArea.setCaretPosition(doc.getLength());
            } catch (BadLocationException e) {
                e.printStackTrace();
            }
        });
    }
    
    // Static method for external classes to log directly to GUI
    public static void log(String message, C.N color) {
        if (instance != null) {
            instance.appendLog(message, color);
        } else {
            // Fallback to console if GUI not available
            C.println(message, color);
        }
    }
    
    private void startServer() {
        startButton.setEnabled(false);
        connectionProgress.setIndeterminate(true);
        connectionProgress.setString("Starting server...");
        
        // Start server in a separate thread to avoid blocking the GUI
        Thread serverThread = new Thread(() -> {
            try {
                appendLog("================================================", C.N.BLUE);
                appendLog("Starting VeemahPay Transaction Server...", C.N.YELLOW);
                
                // Initialize the server using the new modular approach
                ServerManager.startServer();
                
                SwingUtilities.invokeLater(() -> {
                    serverRunning = true;
                    statusLabel.setText("Running");
                    statusLabel.setForeground(new Color(40, 167, 69));
                    connectionLabel.setText("Connected");
                    connectionLabel.setForeground(new Color(40, 167, 69));
                    connectionProgress.setIndeterminate(false);
                    connectionProgress.setValue(100);
                    connectionProgress.setString("Server running successfully");
                    startButton.setEnabled(false);
                    stopButton.setEnabled(true);
                });
                
            } catch (Exception e) {
                SwingUtilities.invokeLater(() -> {
                    appendLog("Failed to start server: " + e.getMessage(), C.N.RED);
                    statusLabel.setText("Error");
                    statusLabel.setForeground(Color.RED);
                    connectionProgress.setIndeterminate(false);
                    connectionProgress.setValue(0);
                    connectionProgress.setString("Failed to start");
                    startButton.setEnabled(true);
                    stopButton.setEnabled(false);
                });
            }
        });
        
        serverThread.start();
    }
    
    private void stopServer() {
        stopButton.setEnabled(false);
        connectionProgress.setString("Stopping server...");
        
        try {
            ServerManager.stopServer();
            
            serverRunning = false;
            statusLabel.setText("X Stopped");
            statusLabel.setForeground(Color.RED);
            connectionLabel.setText("X Disconnected");
            connectionLabel.setForeground(Color.RED);
            connectionProgress.setValue(0);
            connectionProgress.setString("Server stopped");
            startButton.setEnabled(true);
            stopButton.setEnabled(false);
            
            appendLog("Server stopped successfully", C.N.YELLOW);
            
        } catch (Exception e) {
            appendLog("X Error stopping server: " + e.getMessage(), C.N.RED);
            stopButton.setEnabled(true);
        }
    }
    
    private void refreshStatus() {
        appendLog("Refreshing server status...", C.N.BLUE);
        
        if (serverRunning) {
            try {
                // Test database connection
                boolean dbConnected = DatabaseManager.isConnected();
                if (dbConnected) {
                    connectionLabel.setText("Connected");
                    connectionLabel.setForeground(new Color(40, 167, 69));
                    appendLog("Database connection verified", C.N.GREEN);
                } else {
                    connectionLabel.setText("X Database Error");
                    connectionLabel.setForeground(Color.RED);
                    appendLog("X Database connection failed", C.N.RED);
                }
            } catch (Exception e) {
                appendLog("X Status check failed: " + e.getMessage(), C.N.RED);
            }
        } else {
            appendLog("Server is not running", C.N.YELLOW);
        }
    }
    
    private void clearLogs() {
        try {
            doc.remove(0, doc.getLength());
            appendLog("Console cleared", C.N.BLUE);
        } catch (BadLocationException e) {
            System.err.println("Error clearing logs: " + e.getMessage());
        }
    }
    
    public static void main(String[] args) {
        // Use default look and feel
        
        SwingUtilities.invokeLater(() -> {
            ServerGUI gui = new ServerGUI();
            gui.setVisible(true);
            gui.appendLog("VeemahPay Server Console initialized", C.N.GREEN);
            gui.appendLog("Click 'Start Server' to begin", C.N.BLUE);
        });
    }
}