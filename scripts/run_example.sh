#!/bin/bash
# Complete workflow to run Lightpanda + Stagehand + NVIDIA NIM

set -e

echo "🚀 Lightpanda + Stagehand + NVIDIA NIM Integration"
echo "=" | tr '=' '=' | head -c 80; echo

# Check if lightpanda binary exists
if [ ! -f "./lightpanda" ]; then
    echo "❌ Lightpanda binary not found!"
    echo "Run: curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux && chmod a+x ./lightpanda"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Stop any existing lightpanda processes
echo "🧹 Cleaning up existing Lightpanda processes..."
pkill -f "lightpanda serve" 2>/dev/null || true
sleep 1

# Start Lightpanda
echo "🚀 Starting Lightpanda browser..."
./lightpanda serve --host 127.0.0.1 --port 9222 > lightpanda.log 2>&1 &
LIGHTPANDA_PID=$!
echo "✅ Lightpanda started with PID: $LIGHTPANDA_PID"

# Wait for Lightpanda to be ready
echo "⏳ Waiting for Lightpanda to be ready..."
for i in {1..10}; do
    if curl -s http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
        echo "✅ Lightpanda is ready!"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Lightpanda failed to start. Check lightpanda.log"
        kill $LIGHTPANDA_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Run the Python script
echo ""
echo "🐍 Running Python integration script..."
echo ""
uv run python main.py

# Cleanup
echo ""
echo "🧹 Stopping Lightpanda..."
kill $LIGHTPANDA_PID 2>/dev/null || true
echo "✅ Done!"
