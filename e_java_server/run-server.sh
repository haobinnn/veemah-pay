#!/bin/bash

<<<<<<< HEAD
# VeemahPay Transaction Server Build & Run Script
echo "================================================"
echo "VeemahPay Transaction Server"
echo "================================================"
=======
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

# VeemahPay Transaction Server Build & Run Script
red   "================================================"
green "         VeemahPay Transaction Server"
red   "================================================"
>>>>>>> a33913a (java-working)

# Set paths
SERVER_DIR="/media/deadbush225/LocalDisk/System/Coding/For School/veemah-pay/e_java_server"
POSTGRES_JAR_URL="https://jdbc.postgresql.org/download/postgresql-42.7.3.jar"
POSTGRES_JAR="postgresql-42.7.3.jar"

cd "$SERVER_DIR"

# Check if PostgreSQL driver exists
if [ ! -f "$POSTGRES_JAR" ]; then
<<<<<<< HEAD
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
=======
    blue "Downloading PostgreSQL JDBC driver..."
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

# Compile Java files
blue "Compiling Java server..."
javac -cp ".:$POSTGRES_JAR" *.java

if [ $? -eq 0 ]; then
    green "Compilation successful"
else
    red "Compilation failed"
>>>>>>> a33913a (java-working)
    exit 1
fi

# Start server
<<<<<<< HEAD
echo "🚀 Starting VeemahPay Transaction Server..."
=======
echo "Starting VeemahPay Transaction Server..."
>>>>>>> a33913a (java-working)
echo ""
java -cp ".:$POSTGRES_JAR" Server

# Cleanup on exit
<<<<<<< HEAD
echo ""
echo "🛑 Server stopped"
=======
red "Exiting..."
echo ""
red "Server stopped"

>>>>>>> a33913a (java-working)
