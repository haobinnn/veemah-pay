
#!/bin/bash

function red() {
    echo -e "\e[31m$1\e[0m"
}

function green() {
    echo -e "\e[32m$1\e[0m"
}

function yellow() {
    echo -e "\e[33m$1\e[0m"
}

function blue() {
    echo -e "\e[34m$1\e[0m"
}

function white() {
    echo -e "\e[37m$1\e[0m"
}

stop_all() {
  red "Stopping servers..."
  # Stop Java server
  if [ -n "${JAVA_PID:-}" ] && kill -0 "$JAVA_PID" 2>/dev/null; then
    red "Stopping Java server (PID: $JAVA_PID)..."
    kill "$JAVA_PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$JAVA_PID" 2>/dev/null; then
      kill -9 "$JAVA_PID" 2>/dev/null || true
    fi
  fi

  # Stop ngrok
  if [ -n "${NGROK_PID:-}" ] && kill -0 "$NGROK_PID" 2>/dev/null; then
    red "Stopping ngrok (PID: $NGROK_PID)..."
    kill "$NGROK_PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$NGROK_PID" 2>/dev/null; then
      kill -9 "$NGROK_PID" 2>/dev/null || true
    fi
  fi

  green "All processes stopped"
}

# VeemahPay Transaction Server Build & Run Script (GUI Mode Only)
yellow "================================================"
white  "         VeemahPay Transaction Server"
yellow "================================================"

# Set paths
SERVER_DIR="/media/deadbush225/LocalDisk/System/Coding/For School/veemah-pay/e_java_server"
POSTGRES_JAR_URL="https://jdbc.postgresql.org/download/postgresql-42.7.4.jar"
POSTGRES_JAR="postgresql-42.7.4.jar"

cd "$SERVER_DIR"

# Check if PostgreSQL driver exists
if [ ! -f "$POSTGRES_JAR" ]; then
    yellow "Downloading PostgreSQL JDBC driver..."
    wget -O "$POSTGRES_JAR" "$POSTGRES_JAR_URL"
    if [ $? -eq 0 ]; then
        green "PostgreSQL driver downloaded successfully"
    else
        red "Failed to download PostgreSQL driver"
        yellow "Please download manually from: $POSTGRES_JAR_URL"
        exit 1
    fi
else
    green "PostgreSQL driver found"
fi

# Compile Java files (including modules)
yellow "Compiling Java server with modular structure..."
javac -cp ".:$POSTGRES_JAR" *.java modules/*/*.java

if [ $? -eq 0 ]; then
    green "Compilation successful\n"
else
    red "Compilation failed"
    exit 1
fi

# Start server
green "Starting VeemahPay Transaction Server in GUI mode...\n"

# Always start in GUI mode
green "Starting server with graphical interface..."
java -cp ".:$POSTGRES_JAR" ServerGUI

# User pressed enter — stop both
stop_all

# Cleanup on exit
red "Exiting...\n"