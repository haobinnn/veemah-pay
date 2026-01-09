# VeemahPay Server GUI

## 🖥️ Graphical User Interface for Transaction Server

This GUI provides a user-friendly interface to manage the VeemahPay Transaction Server with real-time logging, colored output, and server controls.

### ✨ Features

#### 📊 **Server Status Dashboard**
- **Real-time Status**: Shows current server status (Running/Stopped)
- **Port Information**: Displays the port the server is listening on (8081)
- **Database Status**: Live database connection status
- **Connection Progress**: Visual progress bar for server operations

#### 📝 **Live Log Viewer**
- **Colored Output**: Maintains the original color scheme from console output
  - 🔴 **Red**: Errors and critical messages
  - 🟢 **Green**: Success messages and confirmations
  - 🟡 **Yellow**: Warnings and informational messages
  - 🔵 **Blue**: System operations and headers
- **Timestamps**: Automatic timestamps for all log entries
- **Auto-scroll**: Automatically scrolls to show latest logs
- **Searchable**: Full log history with scroll capability

#### 🎮 **Server Controls**
- **🚀 Start Server**: Initialize database connection and start HTTP server
- **⏹️ Stop Server**: Gracefully shutdown server and close database connections
- **🔄 Refresh Status**: Check current database and server status
- **🗑️ Clear Logs**: Clear the log display (keeps history in memory)

#### 🎨 **User Interface Components**
- **Modern Swing Design**: Clean, professional interface
- **Responsive Layout**: Adapts to different window sizes
- **Status Indicators**: Visual indicators for all server states
- **Progress Feedback**: Shows operation progress in real-time

### 🚀 **How to Launch**

#### Option 1: Direct GUI Launch
```bash
./launch-gui.sh
```

#### Option 2: Via Run Script
```bash
./run-server.sh --gui
# or
./run-server.sh -g
```

#### Option 3: Direct Java Command
```bash
java -cp ".:postgresql-42.7.4.jar" ServerGUI
```

### 🔧 **GUI Components Showcase**

The GUI demonstrates various Java Swing components:

1. **JFrame**: Main window container
2. **JPanel**: Multiple panels for layout organization
3. **JTextPane**: Styled text area for colored log output
4. **JScrollPane**: Scrollable log viewer
5. **JButton**: Control buttons with custom styling
6. **JLabel**: Status indicators and information display
7. **JProgressBar**: Connection and operation progress
8. **BorderLayout**: Main window layout
9. **GridLayout**: Status information grid
10. **FlowLayout**: Button arrangements
11. **StyledDocument**: For colored text formatting
12. **Custom Styles**: Color-coded text styles matching console output

### 📋 **Server Operations**

#### Starting the Server
1. Click **🚀 Start Server**
2. Watch the progress bar and logs
3. Server status will update to "✅ Running"
4. Database status will show "✅ Connected"

#### Monitoring Operations
- All server activities appear in real-time in the log area
- Status indicators update automatically
- Use **🔄 Refresh Status** to manually check server health

#### Stopping the Server
1. Click **⏹️ Stop Server**
2. Server will gracefully shutdown
3. Database connections will be closed
4. Status will update to "❌ Stopped"

### 🎯 **Benefits Over Console Mode**

- **Visual Feedback**: Immediate visual status updates
- **Log History**: Easy to scroll through previous logs
- **No Terminal Required**: Runs in its own window
- **User-Friendly**: Point-and-click server management
- **Professional Appearance**: Modern GUI suitable for demonstrations
- **Multi-tasking**: Can run alongside other applications

### 🔍 **Technical Details**

- **Threading**: Server operations run in separate threads to prevent GUI freezing
- **SwingUtilities**: Proper event dispatch thread usage for thread safety
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Resource Management**: Proper cleanup of database connections and server resources
- **Memory Efficient**: Optimized for long-running server management

### 🐛 **Troubleshooting**

If the GUI doesn't launch:
1. Ensure PostgreSQL JDBC driver is downloaded: `./run-server.sh` first
2. Check Java version: `java -version`
3. Verify compilation: `javac -cp ".:postgresql-42.7.4.jar" *.java`
4. Check environment variables: Ensure `DATABASE_URL` is set

The GUI provides the same functionality as the console version but with a much more user-friendly interface! 🎉