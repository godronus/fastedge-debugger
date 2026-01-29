# Proxy-WASM Test Runner - Project Overview

## Project Goal

Build a Postman-like test runner for debugging proxy-wasm CDN binaries that run on FastEdge. The runner allows developers to:

- Load proxy-wasm WASM binaries compiled from AssemblyScript
- Send simulated HTTP requests through the proxy-wasm hooks
- See debug output, logs, and state changes
- Test binaries locally before deploying to production

## Production Context

- **Production Environment**: nginx + custom wasmtime host
- **SDK**: G-Core's proxy-wasm AssemblyScript SDK (https://github.com/G-Core/proxy-wasm-sdk-as)
- **ABI**: Standard proxy-wasm ABI with specific format requirements for the G-Core SDK
- **CDN Use Case**: Binaries run on FastEdge CDN for request/response manipulation

## Architecture

### Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React 19 + Vite + TypeScript
- **WASM Runtime**: Node's WebAssembly API with WASI preview1
- **Port**: 5179 (configurable via PORT env var)

### Project Structure

```
server/                       # Backend code (formerly src/)
  server.ts                   # Express server with /api/load and /api/call endpoints
  tsconfig.json              # Extends base tsconfig.json
  runner/
    ProxyWasmRunner.ts        # Main orchestrator (340 lines)
    HostFunctions.ts          # Proxy-wasm host function implementations (413 lines)
    HeaderManager.ts          # Header serialization/deserialization (66 lines)
    MemoryManager.ts          # WASM memory operations (165 lines)
    PropertyResolver.ts       # Property path resolution (160 lines)
    types.ts                  # Shared TypeScript types (60 lines)

frontend/                     # React + Vite frontend
  src/
    components/               # React components
      WasmLoader.tsx         # File upload component
      HeadersEditor.tsx      # Headers input component
      PropertiesEditor.tsx   # JSON properties editor
      RequestBar.tsx         # Method selector, URL input, Send button
      RequestTabs.tsx        # Request headers/body/properties tabs
      HookStagesPanel.tsx    # Hook execution logs and inputs viewer
      ResponseViewer.tsx     # Response display with Body/Preview/Headers tabs
      CollapsiblePanel.tsx   # Reusable collapsible panel wrapper
    hooks/
      useWasm.ts            #React UI (base64 upload)
- [x] Execute proxy-wasm hooks: onRequestHeaders, onRequestBody, onResponseHeaders, onResponseBody
- [x] Capture logs from `proxy_log` and `fd_write` (stdout) with log level filtering
- [x] Log level filtering: Trace(0), Debug(1), Info(2), Warn(3), Error(4), Critical(5)
- [x] Header serialization in G-Core SDK format
- [x] Property resolution (request.method, request.path, request.url, request.host, response.code, etc.)
- [x] Request metadata (headers, body, trailers)
- [x] Response metadata (headers, body, trailers)
- [x] "Run All Hooks" button for full request flow simulation
- [x] React-based frontend with component architecture
- [x] TypeScript type safety throughout (frontend + backend)
- [x] Vite build system for fast development
- [x] SPA routing with Express fallback

### ⚠️ Known Issues

- `proxy_on_vm_start` and `proxy_on_configure` fail with "Unexpected 'null'" errors
  - Non-blocking: hooks still execute successfully
  - Likely missing host functions the SDK tries to call during initialization
  - Error handling catches these, execution continues
- Native `fetch()` overrides `Host` header based on target URL
  - Workaround: Original host is preserved as `X-Forwarded-Host`
  - This is standard proxy behavior

### 🚧 Not Yet Implemented

- HTTP callouts (proxy_http_call)
- Shared data/queue operations
- Metrics support
- Full property path coverage (only common paths implemented)
- Request/response trailers (map types implemented but not tested)
```

## Current Status

### ✅ Working Features

- [x] Load WASM binaries via UI
- [x] Execute proxy-wasm hooks: onRequestHeaders, onRequestBody, onResponseHeaders, onResponseBody
- [x] Request header modifications flow through to HTTP fetch
- [x] Response header modifications apply correctly (MapType bug fixed Jan 29, 2026)
- [x] Request body modifications flow through to HTTP fetch
- [x] Response body modifications work correctly
- [x] Real HTTP requests with WASM-modified headers and body
- [x] Capture logs from `proxy_log` and `fd_write` (stdout)
- [x] Log level filtering: Trace(0), Debug(1), Info(2), Warn(3), Error(4), Critical(5)
- [x] Header serialization in G-Core SDK format
- [x] Property resolution (request.method, request.path, request.url, request.host, response.code, etc.)
- [x] Full request/response pipeline with hook chaining
- [x] Postman-like UI with collapsible panels
- [x] TypeScript type safety throughout (frontend + backend)
- [x] Vite build system with fast HMR
- [x] Works with change-header-code.wasm test binary

### ⚠️ Known Issues

- `proxy_on_vm_start` and `proxy_on_configure` fail with "Unexpected 'null'" errors
  - Non-blocking: hooks still execute successfully
  - Likely missing host functions the SDK tries to call during initialization
  - Error handling catches these, execution continues

### 🚧 Not Yet Implemented

- HTTP callouts (proxy_http_call)
- Shared data/queue operations
- Metrics support
- Full property path coverage (only common paths implemented)
- Request/response trailers (map types implemented but not tested)

## Critical Technical Details

### Header Serialization Format

**This was the major breakthrough.** The G-Core AssemblyScript SDK expects a specific binary format:

```
[num_pairs: u32]                          # Header pair count
[key1_len: u32][val1_len: u32]           # Size array for all pairs
[key2_len: u32][val2_len: u32]
...
[key1_bytes][0x00]                        # Data with null terminators
[val1_bytes][0x00]
[key2_bytes][0x00]
[val2_bytes][0x00]
...
```

**Example** (2 headers: "host: example.com" and "x-custom-relay: Fifteen"):

```
02 00 00 00                               # 2 pairs
04 00 00 00 0b 00 00 00                  # "host" = 4 bytes, "example.com" = 11 bytes
0e 00 00 00 07 00 00 00                  # "x-custom-relay" = 14 bytes, "Fifteen" = 7 bytes
68 6f 73 74 00                            # "host\0"
pnpm install
pnpm run build          # Builds both backend and frontend
pnpm start              # Starts server on port 5179
```

Or run in development mode:

```bash
pnpm run dev:backend    # Runs backend with watch mode
pnpm run dev:frontend   # Runs Vite dev server on port 5173 (with proxy to backend)
```

### Build Commands

- `pnpm run build` - Build both backend and frontend
- `pnpm run build:backend` - Build only backend (TypeScript → dist/)
- `pnpm run build:frontend` - Build only frontend (React → dist/frontend/)
- `pnpm run dev:backend` - Run backend in watch mode
- `pnpm run dev:frontend` - Run Vite dev server with hot reload

### Debug Mode

Set `PROXY_RUNNER_DEBUG=1` to see detailed logs:

- Host function calls
- Memory operations
- Header hex dumps
- Trap information

### Loading a Binary

1. Open http://localhost:5179
2. Click file input and select a .wasm file
3. File is read in browser and sent as base64 to `/api/load`
4. Wait for success message

### Running Hooks

1. Configure request headers, body, trailers (supports key:value format)
2. Configure response headers, body, trailers
3. Set properties (JSON format)
4. Select log level (default: Info)
5. Click "Run All Hooks" or individual hook buttons
6. View output with logs and return codes
   Path separators supported: `\0` (null), `.` (dot), `/` (slash)

## How to Use

### Running the Server

```bash
npm install
npm run build
PROXY_RUNNER_DEBUG=1 PORT=5180 npm start
```

### Debug Mode

Set `PROXY_RUNNER_DEBUG=1` to see detailed logs:

- Host function calls
- Memory operations
- Header hex dumps
- Trap information

### Loading a Binary

1. Open http://localhost:5180
2. Click "Choose File" and select a .wasm file
3. Click "Load"
4. Wait for "Loaded successfully"

### Running Hooks

1. Configure request (method, path, headers, body)
2. Configure response (status, headers, body)G-Core SDK format
   - Tried: simple length-prefixed format ❌
   - Tried: null-terminated strings only ❌
   - Tried: count prefix without null terminators ❌
   - **Success**: Count + size array + null-terminated data ✅
3. **Frontend Migration**: Vanilla JS → React + Vite + TypeScript
   - Component-based architecture for better maintainability
   - Type-safe API layer
   - Modern development workflow with hot reload
4. **Project Structure Reorganization**:
   - `src/` → `server/` for clarity
   - Separate `frontend/` directory
   - Base `tsconfig.json` extended by both backend and frontend
   - Build outputs: `dist/` (backend at root, frontend at dist/frontend/)

### Example Request

```json
// Request Headers
{"host": "example.com", "x-custom-header": "value"}

// Properties
{"root_id": "httpheaders", "fastedge.trace_id": "test-123"}
```

## Development History

### Evolution of the Project

1. **Initial**: Monolithic 942-line ProxyWasmRunner.ts
2. **Refactoring**: Split into 6 modular files for maintainability
3. **Header Format Discovery**: Critical breakthrough in G-Core SDK format
   - Tried: simple length-prefixed format ❌
   - Tried: null-terminated strings only ❌
   - Tried: count prefix without null terminators ❌
   - **Success**: Count + size array + null-terminated data ✅
4. **Frontend Migration**: Vanilla JS → React 19 + Vite + TypeScript
   - Component-based architecture for better maintainability
   - Type-safe API layer
   - Modern development workflow with hot reload
5. **UI Redesign** (January 2026):
   - Moved "Send" button to request bar (Postman-like)
   - Tabbed hook stages panel with Logs/Inputs views
   - Response viewer with Body/Preview/Headers
   - Smart tab visibility based on content type
6. **HTTP Integration**: Added actual fetching between hooks
   - Request hooks modify headers/body
   - Real HTTP request with modifications
   - Response hooks process real server response
   - Binary content handling with base64 encoding

### Test Binaries

- **basic-wasm-code.md**: Simple binary that logs hook invocations
  - Tests: Basic hook execution, logging
  - Status: Works perfectly

- **print-wasm-code.md**: Complex binary that parses and prints headers
  - Tests: Header serialization, property resolution, SDK integration
  - Status: Works with correct header format

- **change-header-code.md**: Request modification binary (Added Jan 29, 2026)
  - Tests: Header injection, body modification, set_buffer_bytes
  - Features: Injects `x-custom-me` header, conditionally modifies JSON body
  - Status: Header injection verified working, body modification in testing

## Code Quality Notes

### Strengths

- Clean modular separation of concerns
- Comprehensive error handling as JSON

5. Automated testing suite

- Debug logging throughout
- Type safety with TypeScript
- Memory management abstraction

### Areas for Improvement

- Missing host functions cause initialization errors (non-critical)
- Could add more proxy-wasm host functions
- UI could be more feature-rich (file upload, save/load test cases)
- No tests yet

## Future Enhancements

### Short Term

1. Fix initialization errors by implementing missing host functions
2. Add more property paths
3. Better error messages in UI

### Medium Term

1. Support for HTTP callouts (proxy_http_call)
2. Shared data operations
3. Metrics support
4. Save/load test configurations

### Long Term

1. Support for multiple WASM binaries in one session
2. Request/response history
3. Diff view for header/body changes
4. Integration with CI/CD pipelines

## Debugging Tips

### Common Issues

**Headers not parsing correctly**

- Check hex dump in debug logs
- Verify format matches Kong SDK expectations
- Ensure null terminators are present

**Hook returns unexpected value**

- Check logs for "debug: host_call ..." to see what WASM requested
- Verify property value6, 2026
  Status: React frontend complete, log filtering working, core features stable

**WASM initialization fails**

- Usually non-critical if hooks still execute
- Check what host functions WASM imports vs what we provide
- Add missing functions to HostFunctions.ts if needed

**Memory errors**

- Ensure allocator is available (proxy_on_memory_allocate or malloc)
- Check memory growth in MemoryManager.hostAllocate()
- Verify pointers aren't out of bounds

## References

- [G-Core Proxy-WASM AssemblyScript SDK](https://github.com/G-Core/proxy-wasm-sdk-as)
- [Proxy-WASM Spec](https://github.com/proxy-wasm/spec)
- [WebAssembly JavaScript API](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [WASI Preview1](https://github.com/WebAssembly/WASI/blob/main/legacy/preview1/docs.md)

## Contact & Context

This test runner was built for FastEdge CDN binary development. The code runs in production on nginx with a custom wasmtime host, so exact format compatibility with the G-Core SDK is critical.

Last Updated: January 29, 2026
Status: Full request/response modification pipeline working, MapType bug fixed, response header modifications verified, UI refactored with reusable components
