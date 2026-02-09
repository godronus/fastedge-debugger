# AI Agent API Guide

## Quick Start

The Proxy-WASM Test Runner provides a simple HTTP API that AI agents can use to test WASM binaries. **When you send requests, the UI automatically updates in real-time via WebSocket** to show your activity.

✅ **WebSocket Integration**: All API calls are visible to connected UI clients in real-time\n✅ **Multi-client Support**: Multiple users can observe your test activity simultaneously\n✅ **Event Tracking**: Every hook execution is broadcast with timing and state changes

## Base URL

**Recommended**: `http://127.0.0.1:5179` (optimized for fast WebSocket connections)

Alternative: `http://localhost:5179` (may have slower WebSocket performance)

## Identifying Your Requests

Add the `X-Source` header to help humans understand where requests come from:

```bash
-H "X-Source: ai_agent"
```

This will show up in the UI and logs so humans can distinguish between their manual tests and your automated ones.

## API Endpoints

### 1. Load WASM Binary

Load a WASM binary before testing.

**Endpoint:** `POST /api/load`

**Request:**

```json
{
  "wasmBase64": "AGFzbQEAAAA...", // Base64-encoded WASM binary
  "dotenvEnabled": true // Optional - default true. Load .env files for secrets/dictionary
}
```

**Response:**

```json
{
  "ok": true
}
```

**Note:** When `dotenvEnabled` is true (default), the server automatically loads secrets from `.env.secrets` and dictionary values from `.env.variables` files in the project root. See [DOTENV.md](../features/DOTENV.md) for details.

**Example:**

```bash
# Read WASM file and convert to base64
WASM_BASE64=$(base64 -w 0 your-binary.wasm)

curl -X POST http://localhost:5179/api/load \
  -H "Content-Type: application/json" \
  -H "X-Source: ai_agent" \
  -d "{\"wasmBase64\": \"$WASM_BASE64\"}"
```

### 2. Execute Full Request Flow

Send a complete HTTP request through all proxy-wasm hooks.

**Endpoint:** `POST /api/send`

**Request:**

```json
{
  "url": "https://cdn-origin-4732724.fastedge.cdn.gc.onl/",
  "request": {
    "method": "POST",
    "headers": {
      "content-type": "application/json",
      "x-custom-header": "value"
    },
    "body": "{\"message\": \"Hello\"}"
  },
  "properties": {
    "request.country": "US",
    "request.city": "New York"
  },
  "logLevel": 2
}
```

**Fields:**

- `url` (required): Target URL for the proxied request
- `request.method` (optional): HTTP method, default "GET"
- `request.headers` (optional): Request headers object
- `request.body` (optional): Request body string
- `properties` (optional): Proxy-wasm properties for `get_property()` calls
- `logLevel` (deprecated): Ignored by server - all logs are always returned at Trace level. UI handles filtering client-side.

**Response:**

```json
{
  "ok": true,
  "hookResults": {
    "onRequestHeaders": {
      "returnCode": 0,
      "logs": [
        {"level": 1, "message": "onRequestHeaders >> injecting header..."},
        {"level": 0, "message": "Debug output..."}
      ],
      "input": { "request": {...}, "response": {...} },
      "output": { "request": {...}, "response": {...} }
    },
    "onRequestBody": {...},
    "onResponseHeaders": {...},
    "onResponseBody": {...}
  },
  "finalResponse": {
    "status": 200,
    "statusText": "OK",
    "headers": {...},
    "body": "...",
    "contentType": "application/json",
    "isBase64": false
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:5179/api/send \
  -H "Content-Type: application/json" \
  -H "X-Source: ai_agent" \
  -d '{
    "url": "https://cdn-origin-4732724.fastedge.cdn.gc.onl/",
    "request": {
      "method": "POST",
      "headers": {
        "content-type": "application/json"
      },
      "body": "{\"message\": \"Hello from AI\"}"
    },
    "logLevel": 2
  }'
```

### 3. Load Test Configuration (February 2026)

Read the current test configuration that the developer has set up.

**Endpoint:** `GET /api/config`

**Response:**

```json
{
  "ok": true,
  "config": {
    "description": "Test configuration for proxy-wasm debugging",
    "wasm": {
      "path": "wasm/cdn_header_change.wasm",
      "description": "Header modification test"
    },
    "request": {
      "method": "POST",
      "url": "https://cdn-origin-4732724.fastedge.cdn.gc.onl/",
      "headers": {...},
      "body": "{...}"
    },
    "properties": {...},
    "logLevel": 0
  }
}
```

**Purpose**: Get baseline test settings configured by the developer. Use these as defaults and override specific values as needed.

**Example:**

```bash
# Read developer's test configuration
curl http://127.0.0.1:5179/api/config

# Use config with overrides
CONFIG=$(curl -s http://127.0.0.1:5179/api/config)
URL=$(echo $CONFIG | python3 -c "import sys, json; print(json.load(sys.stdin)['config']['request']['url'])")

# Now use that URL in your test
curl -X POST http://127.0.0.1:5179/api/send \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$URL\", ...}"
```

**See also**: [CONFIG_SHARING.md](../features/CONFIG_SHARING.md) for complete workflow documentation.

### 4. Execute Single Hook (Advanced)

Execute a single proxy-wasm hook for testing.

**Endpoint:** `POST /api/call`

**Request:**

```json
{
  "hook": "onRequestHeaders",
  "request": {
    "headers": { "host": "example.com" },
    "body": ""
  },
  "response": {
    "headers": {},
    "body": ""
  },
  "properties": {},
  "logLevel": 2
}
```

**Response:**

```json
{
  "ok": true,
  "result": {
    "returnCode": 0,
    "logs": [...],
    "input": {...},
    "output": {...}
  }
}
```

## Log Levels and Filtering

**Server Behavior (February 2026)**: The server **always** returns all logs at Trace level (0). This ensures no log data is lost.

**Log Structure**: Each log entry has:

- `level`: 0=Trace, 1=Debug, 2=Info, 3=Warn, 4=Error, 5=Critical
- `message`: The actual log message

**Client-Side Filtering**: The UI filters logs based on the selected log level. If you're processing logs programmatically, you can filter them yourself:

```javascript
// Filter logs to only show Info level and above
const filteredLogs = hookResult.logs.filter((log) => log.level >= 2);

// Get all error messages
const errors = hookResult.logs
  .filter((log) => log.level >= 4)
  .map((log) => log.message);
```

## Real-Time UI Updates

When you send requests:

1. **UI shows request started** - URL, method, headers appear in UI
2. **Hook execution updates** - Each hook's results appear incrementally
3. **Final response displayed** - Complete response shown in Response Viewer
4. **Connection status** - UI shows "Connected (N clients)" with your agent counted

This means humans can:

- Watch your tests run in real-time
- Debug issues by seeing exactly what your agent sends
- Verify WASM behavior with visual feedback

## Testing Workflow

### Basic Test

```bash
#!/bin/bash

# 1. Load WASM binary
WASM_BASE64=$(base64 -w 0 my-proxy.wasm)
curl -X POST http://localhost:5179/api/load \
  -H "Content-Type: application/json" \
  -H "X-Source: ai_agent" \
  -d "{\"wasmBase64\": \"$WASM_BASE64\"}"

# 2. Send test request
curl -X POST http://localhost:5179/api/send \
  -H "Content-Type: application/json" \
  -H "X-Source: ai_agent" \
  -d '{
    "url": "http://httpbin.org/post",
    "request": {
      "method": "POST",
      "headers": {
        "content-type": "application/json",
        "x-test-header": "test-value"
      },
      "body": "{\"test\": true}"
    },
    "logLevel": 2
  }' | jq .
```

### Automated Testing Suite

```python
import requests
import base64
import json

BASE_URL = "http://localhost:5179"
HEADERS = {
    "Content-Type": "application/json",
    "X-Source": "ai_agent_python"
}

def load_wasm(wasm_path):
    """Load WASM binary"""
    with open(wasm_path, 'rb') as f:
        wasm_bytes = f.read()
    wasm_base64 = base64.b64encode(wasm_bytes).decode('utf-8')

    response = requests.post(
        f"{BASE_URL}/api/load",
        headers=HEADERS,
        json={"wasmBase64": wasm_base64}
    )
    return response.json()

def send_request(url, method="GET", headers=None, body="", properties=None, log_level=2):
    """Send test request through proxy-wasm"""
    payload = {
        "url": url,
        "request": {
            "method": method,
            "headers": headers or {},
            "body": body
        },
        "properties": properties or {},
        "logLevel": log_level
    }

    response = requests.post(
        f"{BASE_URL}/api/send",
        headers=HEADERS,
        json=payload
    )
    return response.json()

# Run tests
print("Loading WASM...")
result = load_wasm("my-proxy.wasm")
print(f"Load result: {result}")

print("\nSending test request...")
result = send_request(
    url="http://httpbin.org/post",
    method="POST",
    headers={"content-type": "application/json"},
    body='{"test": true}'
)

print(f"Status: {result['finalResponse']['status']}")
print(f"Hooks executed: {list(result['hookResults'].keys())}")
```

### Node.js Example

```javascript
const fetch = require("node-fetch");
const fs = require("fs");

const BASE_URL = "http://localhost:5179";

async function loadWasm(wasmPath) {
  const wasmBuffer = fs.readFileSync(wasmPath);
  const wasmBase64 = wasmBuffer.toString("base64");

  const response = await fetch(`${BASE_URL}/api/load`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Source": "ai_agent_node",
    },
    body: JSON.stringify({ wasmBase64 }),
  });

  return response.json();
}

async function sendRequest(url, options = {}) {
  const payload = {
    url,
    request: {
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body || "",
    },
    properties: options.properties || {},
    logLevel: options.logLevel !== undefined ? options.logLevel : 2,
  };

  const response = await fetch(`${BASE_URL}/api/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Source": "ai_agent_node",
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

// Usage
(async () => {
  console.log("Loading WASM...");
  await loadWasm("./my-proxy.wasm");

  console.log("Sending request...");
  const result = await sendRequest("http://httpbin.org/get", {
    method: "GET",
    headers: { "x-test": "value" },
  });

  console.log("Result:", JSON.stringify(result, null, 2));
})();
```

## Log Levels

Control verbosity of WASM logs:

| Level    | Value | Description                   |
| -------- | ----- | ----------------------------- |
| Trace    | 0     | Most verbose, all logs        |
| Debug    | 1     | Debug information             |
| Info     | 2     | General information (default) |
| Warn     | 3     | Warnings only                 |
| Error    | 4     | Errors only                   |
| Critical | 5     | Critical errors only          |

## Properties

Properties are available to WASM via `get_property()` calls:

### Common Properties

```json
{
  "request.method": "POST",
  "request.url": "http://example.com/path",
  "request.host": "example.com",
  "request.path": "/path",
  "request.scheme": "http",
  "request.country": "US",
  "request.city": "New York",
  "request.geo.lat": "40.7128",
  "request.geo.long": "-74.0060",
  "response.code": "200",
  "response.status": "200"
}
```

### Custom Properties

You can pass any custom properties:

```json
{
  "properties": {
    "my.custom.property": "value",
    "app.version": "1.0.0",
    "feature.enabled": "true"
  }
}
```

## Error Handling

### HTTP Errors

```json
{
  "ok": false,
  "error": "Error message here"
}
```

### WASM Execution Errors

Hook results include error information:

```json
{
  "hookResults": {
    "onRequestHeaders": {
      "returnCode": null,
      "logs": [...],
      "error": "Hook execution failed: ..."
    }
  }
}
```

## Best Practices

### 1. Always Identify Yourself

```bash
-H "X-Source: ai_agent_myname"
```

### 2. Use Appropriate Log Levels

- Development: `"logLevel": 0` (Trace)
- Testing: `"logLevel": 2` (Info)
- Production: `"logLevel": 3` (Warn)

### 3. Handle Errors Gracefully

```python
try:
    result = send_request(...)
    if not result.get('ok'):
        print(f"Error: {result.get('error')}")
except Exception as e:
    print(f"Request failed: {e}")
```

### 4. Verify WASM Load Success

```bash
response=$(curl -s -X POST http://localhost:5179/api/load \
  -H "Content-Type: application/json" \
  -d "{\"wasmBase64\": \"$WASM_BASE64\"}")

if echo "$response" | jq -e '.ok' > /dev/null; then
  echo "WASM loaded successfully"
else
  echo "Failed to load WASM"
  exit 1
fi
```

## Debugging

### Check Server Connection

```bash
curl http://localhost:5179/
# Should return the UI HTML
```

### Verify WebSocket Connection

Open browser console at `http://localhost:5179`:

```javascript
// Check connection status
// Look for green "Connected" indicator in UI header
```

### View Server Logs

```bash
PROXY_RUNNER_DEBUG=1 pnpm start
# Shows detailed execution logs
```

### Check Request/Response Flow

```bash
curl -X POST http://localhost:5179/api/send \
  -H "Content-Type: application/json" \
  -H "X-Source: ai_agent" \
  -d '...' | jq '.hookResults.onRequestHeaders.logs'
# View logs from specific hook
```

## Support

If you encounter issues:

1. Check server is running: `http://localhost:5179`
2. Verify WASM binary is valid
3. Check server logs for errors
4. Open UI in browser to see visual feedback
5. Review [WEBSOCKET_IMPLEMENTATION.md](../features/WEBSOCKET_IMPLEMENTATION.md) for architecture details

## Summary

The API is simple:

1. **Load WASM** (`POST /api/load`)
2. **Send requests** (`POST /api/send`)
3. **Watch results** in UI or parse JSON response

The UI automatically reflects your activity, making debugging and monitoring easy for human developers.

Last Updated: February 6, 2026
