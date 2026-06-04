#!/bin/bash

# EventHub NgROK Backend Setup Script for Mac/Linux
# This script helps you set up and start ngrok tunneling

echo ""
echo "========================================="
echo "EventHub NgROK Setup Script"
echo "========================================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "[ERROR] ngrok is not installed or not in PATH"
    echo ""
    echo "Please install ngrok:"
    echo "- Mac: brew install ngrok/ngrok/ngrok"
    echo "- Linux: https://ngrok.com/download"
    echo "- Or: https://ngrok.com/download"
    echo ""
    exit 1
fi

echo "[OK] ngrok found:"
ngrok version
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed"
    echo "Please install Node.js: https://nodejs.org"
    exit 1
fi

echo "[OK] Node.js found"
node --version
echo ""

# Menu
echo "What would you like to do?"
echo "1 - Start ngrok tunnel for backend (port 3000)"
echo "2 - Start ngrok for both backend and frontend"
echo "3 - Show ngrok tunnel info"
echo "4 - Start backend with ngrok"
echo "5 - View ngrok configuration"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "Starting ngrok tunnel for backend..."
        echo ""
        ngrok http 3000 --config=backend/ngrok.yml --tunnel-name=eventhub-backend
        ;;
    2)
        echo ""
        echo "Starting ngrok tunnels for backend and frontend..."
        echo ""
        ngrok start --config=backend/ngrok.yml eventhub-backend eventhub-frontend
        ;;
    3)
        echo ""
        echo "NgROK tunnel information:"
        echo ""
        ngrok api tunnels list
        ;;
    4)
        echo ""
        echo "Starting backend server and ngrok tunnel..."
        echo ""
        # Start backend in background
        cd backend
        npm run dev &
        BACKEND_PID=$!
        sleep 2

        # Start ngrok in foreground
        ngrok http 3000 --config=ngrok.yml --tunnel-name=eventhub-backend

        # Kill backend when ngrok exits
        kill $BACKEND_PID
        ;;
    5)
        echo ""
        echo "NgROK Configuration:"
        cat backend/ngrok.yml
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
