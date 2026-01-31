#!/bin/bash

# Debug script to check WebSocket connection

echo "=== WebSocket Connection Debugger ==="
echo ""

# Check if server is running
echo "1. Checking if server is running..."
if curl -s http://localhost:5179/ > /dev/null 2>&1; then
    echo "   ✓ HTTP server is responding on port 5179"
else
    echo "   ✗ HTTP server is NOT responding on port 5179"
    echo "   → Run: pnpm start"
    exit 1
fi

# Check server logs
echo ""
echo "2. Server should show these messages on startup:"
echo "   - 'Proxy runner listening on http://localhost:5179'"
echo "   - 'WebSocket available at ws://localhost:5179/ws'"
echo ""
echo "3. Browser console should show:"
echo "   - '[useWebSocket] Connecting to ws://localhost:5179/ws'"
echo "   - '[useWebSocket] Connected'"
echo ""
echo "4. If you see connection errors:"
echo "   a) Check browser console (F12) for WebSocket errors"
echo "   b) Enable debug mode in App.tsx:"
echo "      const { status } = useWebSocket({ debug: true });"
echo "   c) Enable server debug:"
echo "      PROXY_RUNNER_DEBUG=1 pnpm start"
echo ""
echo "5. Test WebSocket with wscat (optional):"
echo "   pnpm add -g wscat"
echo "   wscat -c ws://localhost:5179/ws"
echo ""
