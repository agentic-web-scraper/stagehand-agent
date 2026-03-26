#!/bin/bash
# Start Lightpanda browser binary

echo "🚀 Starting Lightpanda browser..."
./lightpanda serve --host 127.0.0.1 --port 9222 &
LIGHTPANDA_PID=$!

echo "✅ Lightpanda started with PID: $LIGHTPANDA_PID"
echo "📡 CDP endpoint: ws://127.0.0.1:9222"
echo ""
echo "To stop Lightpanda, run: kill $LIGHTPANDA_PID"
echo "Or use: pkill lightpanda"
