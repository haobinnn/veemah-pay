#!/bin/bash

# VeemahPay Transaction Server Build & Run Script
echo "================================================"
echo "VeemahPay Transaction Server"
echo "================================================"

# Set paths
SERVER_DIR="/media/deadbush225/LocalDisk/System/Coding/For School/veemah-pay/e_java_server"
POSTGRES_JAR_URL="https://jdbc.postgresql.org/download/postgresql-42.7.3.jar"
POSTGRES_JAR="postgresql-42.7.3.jar"

cd "$SERVER_DIR"

# Check if PostgreSQL driver exists
if [ ! -f "$POSTGRES_JAR" ]; then
    echo "📥 Downloading PostgreSQL JDBC driver..."
    wget -O "$POSTGRES_JAR" "$POSTGRES_JAR_URL"
    if [ $? -eq 0 ]; then
        echo "✓ PostgreSQL driver downloaded successfully"
    else
        echo "❌ Failed to download PostgreSQL driver"
        echo "Please download manually from: $POSTGRES_JAR_URL"
        exit 1
    fi
else
    echo "✓ PostgreSQL driver found"
fi

# Compile Java files
echo "🔨 Compiling Java server..."
javac -cp ".:$POSTGRES_JAR" *.java

if [ $? -eq 0 ]; then
    echo "✓ Compilation successful"
else
    echo "❌ Compilation failed"
    exit 1
fi

# Start server
echo "🚀 Starting VeemahPay Transaction Server..."
echo ""
java -cp ".:$POSTGRES_JAR" Server

# Cleanup on exit
echo ""
echo "🛑 Server stopped"