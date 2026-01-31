# Backend Architecture

## Overview

The backend is a Node.js + Express + TypeScript server that orchestrates WASM execution for proxy-wasm testing. It loads WASM binaries, executes hooks, performs HTTP requests, and returns detailed execution results.

## Technology Stack

- **Node.js 20.x**: Runtime environment
- **Express 4.x**: Web server framework
- **TypeScript 5.4.5**: Type safety
- **WebAssembly API**: WASM execution (Node.js native)
- **WASI**: WebAssembly System Interface support

## Project Structure

```
server/
├── server.ts              # Express app and API endpoints
├── tsconfig.json         # TypeScript configuration
└── runner/
    ├── ProxyWasmRunner.ts    # Main WASM orchestration
    ├── HostFunctions.ts      # WASM host function implementations
    ├── MemoryManager.ts      # WASM memory management
    ├── HeaderManager.ts      # HTTP header serialization
    ├── PropertyResolver.ts   # Property/metadata resolution
    └── types.ts              # Shared type definitions
```

## Core Components

### server.ts (Express Server)

Main HTTP server with three endpoints:

#### POST /api/load

Loads WASM binary into memory:

```typescript
app.post("/api/load", async (req, res) => {
  const { wasmBase64 } = req.body;
  const buffer = Buffer.from(wasmBase64, "base64");
  await runner.load(buffer);
  res.json({ ok: true });
});
```

#### POST /api/call

Executes a single hook (for manual testing):

```typescript
app.post("/api/call", async (req, res) => {
  const { hook, request, response, properties, logLevel } = req.body;
  const result = await runner.callHook({
    hook,
    request: request ?? { headers: {}, body: "" },
    response: response ?? { headers: {}, body: "" },
    properties: properties ?? {},
    logLevel: logLevel ?? 2,
  });
  res.json({ ok: true, result });
});
```

#### POST /api/send

Executes full flow (all hooks + HTTP fetch):

```typescript
app.post("/api/send", async (req, res) => {
  const { url, request, response, properties, logLevel } = req.body;
  const fullFlowResult = await runner.callFullFlow(
    {
      hook: "",
      request: request ?? { headers: {}, body: "", method: "GET" },
      response: response ?? { headers: {}, body: "" },
      properties: properties ?? {},
      logLevel: logLevel ?? 2,
    },
    url,
  );
  res.json({ ok: true, ...fullFlowResult });
});
```

### ProxyWasmRunner.ts (Core Logic)

Main class orchestrating WASM execution with input/output tracking.

#### Key Methods

**load(buffer: Buffer): Promise<void>**

- Compiles WASM module
- Instantiates with host functions
- Initializes memory manager
- Calls `_start` if exported

**callFullFlow(call: HookCall, targetUrl: string): Promise<FullFlowResult>**

- Executes complete proxy flow:
  1. **Phase 1**: Request hooks (onRequestHeaders → onRequestBody)
  2. **Phase 2**: HTTP fetch to target URL
  3. **Phase 3**: Response hooks (onResponseHeaders → onResponseBody)
- Returns hook results and final response

**Flow with Input/Output Tracking:**

```typescript
// Phase 1: Request Hooks
results.onRequestHeaders = await this.callHook({ hook: "onRequestHeaders", ... });
// Use output from onRequestHeaders as input to onRequestBody
const headersAfterRequestHeaders = results.onRequestHeaders.output.request.headers;

results.onRequestBody = await this.callHook({
  hook: "onRequestBody",
  request: { headers: headersAfterRequestHeaders, ... }
});

// Phase 2: HTTP Fetch
const modifiedRequestHeaders = results.onRequestBody.output.request.headers;
const modifiedRequestBody = results.onRequestBody.output.request.body;
const response = await fetch(targetUrl, {
  method: requestMethod,
  headers: modifiedRequestHeaders,
  body: modifiedRequestBody,
});

// Read complete response (streaming not implemented)
// Note: Waits for entire response before processing
const responseBody = await response.text();  // or arrayBuffer() for binary

// Phase 3: Response Hooks (with modified request context)
results.onResponseHeaders = await this.callHook({
  hook: "onResponseHeaders",
  request: { headers: modifiedRequestHeaders, body: modifiedRequestBody },
  response: { headers: responseHeaders, body: responseBody }
});

const headersAfterResponseHeaders = results.onResponseHeaders.output.response.headers;

results.onResponseBody = await this.callHook({
  hook: "onResponseBody",
  request: { headers: modifiedRequestHeaders, body: modifiedRequestBody },
  response: { headers: headersAfterResponseHeaders, body: responseBody }
});
```

**⚠️ Streaming Limitation:**

The current implementation does not support streaming responses. It uses `await response.text()` or `await response.arrayBuffer()` which waits for the entire response to complete before processing.

**Differences from Production:**

| Aspect            | Test Runner                      | Production (nginx + wasmtime)  |
| ----------------- | -------------------------------- | ------------------------------ |
| Response handling | Single complete chunk            | Incremental chunks             |
| Hook calls        | Once with full body              | Multiple calls as data arrives |
| `end_of_stream`   | Always `true`                    | `false` until last chunk       |
| Memory usage      | Loads entire response            | Processes incrementally        |
| Testing scope     | Final state, total modifications | Streaming logic, backpressure  |

**What works correctly:**

- ✅ Final state after complete response
- ✅ Total body modifications
- ✅ Header modifications
- ✅ Testing non-streaming use cases
- ✅ Most real-world proxy scenarios

**What cannot be tested:**

- ❌ Incremental chunk processing
- ❌ Streaming-specific logic (early termination, chunk-by-chunk transforms)
- ❌ Backpressure handling
- ❌ Behavior when `end_of_stream=false`

**Potential solutions for future:**

1. **Chunk-based processing**: Use `response.body.getReader()` to read stream incrementally
2. **Configurable chunk size**: Split complete responses into artificial chunks for testing
3. **Hybrid mode**: Add a flag to enable streaming vs. complete response testing

**callHook(call: HookCall): Promise<HookResult>**

- Initializes WASM context
- **Captures input state** (before hook execution)
- Executes specific hook function
- **Captures output state** (after hook execution)
- Returns both input and output along with logs

**Input/Output Capture:**

```typescript
// Before hook execution
const inputState = {
  request: {
    headers: { ...requestHeaders },
    body: requestBody,
  },
  response: {
    headers: { ...responseHeaders },
    body: responseBody,
  },
};

// Execute hook
const returnCode = this.callIfExported(exportName, ...args);

// After hook execution
const outputState = {
  request: {
    headers: { ...this.hostFunctions.getRequestHeaders() },
    body: this.hostFunctions.getRequestBody(),
  },
  response: {
    headers: { ...this.hostFunctions.getResponseHeaders() },
    body: this.hostFunctions.getResponseBody(),
  },
};

return {
  returnCode,
  logs: filteredLogs,
  input: inputState,
  output: outputState,
  properties: call.properties,
};
```

#### Error Handling

**Fetch Failures:**

```typescript
catch (error) {
  let errorMessage = "Fetch failed";
  let errorDetails = "";

  if (error instanceof Error) {
    errorMessage = error.message;
    if (error.cause) {
      errorDetails = ` (cause: ${String(error.cause)})`;
    }
  }

  const fullErrorMessage = `Failed to fetch ${requestMethod} ${targetUrl}: ${errorMessage}${errorDetails}`;

  // Return detailed error in response hooks and finalResponse
  return {
    hookResults: { /* with error logs */ },
    finalResponse: {
      status: 0,
      statusText: "Fetch Failed",
      body: fullErrorMessage,
      contentType: "text/plain",
    },
  };
}
```

### HostFunctions.ts

Implements proxy-wasm ABI host functions that WASM code calls:

**Key Functions:**

- `proxy_log`: Logging from WASM
- `proxy_get_header_map_value`: Read headers
- `proxy_add_header_map_value`: Add/modify headers
- `proxy_remove_header_map_value`: Remove headers
- `proxy_get_buffer_bytes`: Read request/response bodies
- `proxy_set_buffer_bytes`: Modify request/response bodies
- `proxy_get_property`: Read properties (metadata, headers, etc.)

**Header Management:**

- Maintains separate maps for request/response headers
- Uses HeaderManager for serialization
- Supports MapType enum (RequestHeaders=0, ResponseHeaders=2, etc.)

**Body Management:**

- Maintains separate strings for request/response bodies
- Supports BufferType enum (RequestBody=0, ResponseBody=1, etc.)

### MemoryManager.ts

Manages WASM linear memory:

**Responsibilities:**

- Allocate/deallocate memory blocks
- Write strings and byte arrays to WASM memory
- Read data from WASM memory
- Track allocations for cleanup

**Key Methods:**

- `allocateString(str: string): number` - Write string to memory, return pointer
- `readString(ptr: number, len: number): string` - Read string from memory
- `allocateBytes(data: Uint8Array): number` - Write bytes to memory
- `deallocate(ptr: number)` - Free memory (currently a no-op)

### HeaderManager.ts

Handles G-Core SDK header serialization format:

**Format:**

```
[count: u32][size1: u32][size2: u32]...[sizeN: u32][key1\0value1\0key2\0value2\0...]
```

**Methods:**

- `serialize(headers: Record<string, string>): Uint8Array` - Convert to binary format
- `deserialize(data: Uint8Array): Record<string, string>` - Parse binary to object
- `normalize(headers: Record<string, string>)` - Lowercase keys, trim values

### PropertyResolver.ts

Resolves property paths for `proxy_get_property`:

**Supported Properties:**

- `request.method`, `request.path`, `request.scheme`
- `request.headers.*` (individual header access)
- `response.status`, `response.statusText`
- `response.headers.*` (individual header access)
- Custom properties from `properties` object

**Example:**

```typescript
propertyResolver.getProperty("request.headers.content-type");
// Returns: "application/json"
```

## Type System

### types.ts

**HookCall:**

```typescript
export type HookCall = {
  hook: string;
  request: {
    headers: HeaderMap;
    body: string;
    method?: string;
    path?: string;
    scheme?: string;
  };
  response: {
    headers: HeaderMap;
    body: string;
    status?: number;
    statusText?: string;
  };
  properties: Record<string, unknown>;
  logLevel?: number;
};
```

**HookResult (with Input/Output):**

```typescript
export type HookResult = {
  returnCode: number | null;
  logs: { level: number; message: string }[];
  input: {
    request: { headers: HeaderMap; body: string };
    response: { headers: HeaderMap; body: string };
  };
  output: {
    request: { headers: HeaderMap; body: string };
    response: { headers: HeaderMap; body: string };
  };
  properties: Record<string, unknown>;
};
```

**FullFlowResult:**

```typescript
export type FullFlowResult = {
  hookResults: Record<string, HookResult>;
  finalResponse: {
    status: number;
    statusText: string;
    headers: HeaderMap;
    body: string;
    contentType: string;
    isBase64?: boolean;
  };
};
```

**Enums:**

```typescript
export enum MapType {
  RequestHeaders = 0,
  RequestTrailers = 1,
  ResponseHeaders = 2,
  ResponseTrailers = 3,
}

export enum BufferType {
  RequestBody = 0,
  ResponseBody = 1,
  VmConfiguration = 6,
  PluginConfiguration = 7,
}
```

## Hook Execution Flow

### Request Phase

1. **onRequestHeaders**
   - Input: Original request headers + metadata
   - Can modify: Request headers
   - Output: Modified request headers

2. **onRequestBody**
   - Input: Modified request headers (from step 1) + request body
   - Can modify: Request headers, request body
   - Output: Final request headers and body for HTTP fetch

### HTTP Fetch

3. **Perform HTTP Request**
   - Uses modified headers/body from onRequestBody
   - Adds `x-forwarded-host` for host header preservation
   - Handles binary responses (base64 encoding)

### Response Phase

4. **onResponseHeaders**
   - Input: Response headers + modified request headers/body
   - Can modify: Response headers
   - Output: Modified response headers

5. **onResponseBody**
   - Input: Modified response headers + response body + modified request context
   - Can modify: Response headers, response body
   - Output: Final response headers and body

## Binary Content Handling

**Detection:**

```typescript
const isBinary =
  contentType.startsWith("image/") ||
  contentType.startsWith("video/") ||
  contentType.startsWith("audio/") ||
  contentType.includes("application/octet-stream") ||
  contentType.includes("application/pdf") ||
  contentType.includes("application/zip");
```

**Encoding:**

- Binary content → base64 encoded
- `isBase64: true` flag set in response
- Frontend can decode for display/preview

## Logging

**Log Levels:**

```typescript
0 = Trace
1 = Debug
2 = Info (default)
3 = Warn
4 = Error
5 = Critical
```

**Log Filtering:**

- Set via `logLevel` parameter
- Filters logs before returning to frontend
- Only logs >= specified level are included

**Debug Mode:**

- Set `PROXY_RUNNER_DEBUG=1` environment variable
- Enables verbose internal logging
- Logs WASM imports/exports, memory operations, etc.

## Development

**Build:**

```bash
pnpm run build:backend  # Compile TypeScript to dist/
```

**Dev Mode:**

```bash
pnpm run dev:backend    # Watch mode with tsx
```

**Production:**

```bash
pnpm start              # Run compiled dist/server.js
```

## Port Configuration

- Default: `5179`
- Override: `PORT=3000 pnpm start`
- Frontend proxies `/api/*` to backend port

## Notes

- WASM module loaded once, reused for all calls
- Each hook execution creates new stream context
- Root context initialized once per WASM load
- Memory manager tracks allocations per execution
- Host header preserved via `x-forwarded-host`
- Input/output capture enables complete execution visibility

Last Updated: January 30, 2026
