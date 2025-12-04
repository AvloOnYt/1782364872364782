#!/bin/bash

echo "========================================="
echo "  Starting CNC Server"
echo "========================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed"
    exit 1
fi

# Check if requirements are installed
if ! python3 -c "import flask" &> /dev/null; then
    echo "[INFO] Installing dependencies..."
    pip3 install -r requirements.txt
fi

# Start the server
echo "[INFO] Starting Flask server..."
python3 app.py
