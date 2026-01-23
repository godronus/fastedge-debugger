# Proxy-WASM Test Runner - Project Overview

## Project Goal

Build a Postman-like test runner for debugging proxy-wasm CDN binaries that run on FastEdge. The runner allows developers to:

- Load proxy-wasm WASM binaries compiled from AssemblyScript
- Send simulated HTTP requests through the proxy-wasm hooks
- See debug output, logs, and state changes
- Test binaries locally before deploying to production

## Production Context

- **Production Environment**: nginx + custom wasmtime host
- **SDK**: Kong's proxy-wasm AssemblyScript SDK (https://github.com/Kong/proxy-wasm-assemblyscript-sdk)
- **ABI**: Standard proxy-wasm ABI with specific format requirements for the Kong SDK
- **CDN Use Case**: Binaries run on FastEdge CDN for request/response manipulation

## Architecture

### Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **WASM Runtime**: Node's WebAssembly API with WASI preview1
- **Port**: 5180 (configurable via PORT env var)

### Project Structure

```
src/
  server.ts                   # Express server with /api/load and /api/call endpoints
  runner/
    ProxyWasmRunner.ts        # Main orchestrator (340 lines)
    HostFunctions.ts          # Proxy-wasm host function implementations (413 lines)
    HeaderManager.ts          # Header serialization/deserialization (66 lines)
    MemoryManager.ts          # WASM memory operations (165 lines)
    PropertyResolver.ts       # Property path resolution (160 lines)
    types.ts                  # Shared TypeScript types (60 lines)
public/
  index.html                  # Test UI
  app.js                      # Frontend logic
  styles.css                  # Dark theme styling
context/
  basic-wasm-code.md          # Simple test binary source
  print-wasm-code.md          # Complex test binary with header parsing
```

## Current Status

### ✅ Working Features

- [x] Load WASM binaries via UI
- [x] Execute proxy-wasm hooks: onRequestHeaders, onRequestBody, onResponseHeaders, onResponseBody
- [x] Capture logs from `proxy_log` and `fd_write` (stdout)
- [x] Header serialization in Kong SDK format (critical fix completed)
- [x] Property resolution (request.method, request.path, request.url, request.host, response.code, etc.)
- [x] Request metadata (method, path, scheme)
- [x] Response metadata (status code, status text)
- [x] "Run All Hooks" button for full request flow simulation
- [x] Works with both basic-wasm-code and print-wasm-code test binaries

### ⚠️ Known Issues

- `proxy_on_vm_start` and `proxy_on_configure` fail with "Unexpected 'null'" errors
  - Non-blocking: hooks still execute successfully
  - Likely missing host functions the SDK tries to call during initialization
  - Error handling catches these, execution continues

### 🚧 Not Yet Implemented

- Response body manipulation by WASM
- HTTP callouts (proxy_http_call)
- Shared data/queue operations
- Metrics support
- Full property path coverage (only common paths implemented)

## Critical Technical Details

### Header Serialization Format

**This was the major breakthrough.** The Kong AssemblyScript SDK expects a specific binary format:

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
65 78 61 6d 70 6c 65 2e 63 6f 6d 00     # "example.com\0"
78 2d 63 75 73 74 6f 6d 2d 72 65 6c 61 79 00  # "x-custom-relay\0"
46 69 66 74 65 65 6e 00                  # "Fifteen\0"
```

See `HeaderManager.serialize()` in [src/runner/HeaderManager.ts](../src/runner/HeaderManager.ts)

### Key SDK Functions Flow

1. **Hook Invocation**: Host calls WASM export `proxy_on_request_headers(context_id, header_count, end_of_stream)`
2. **SDK Internal**: WASM calls host import `proxy_get_header_map_pairs(map_type, ptr_ptr, len_ptr)`
3. **Host Response**: Host writes serialized header data to WASM memory, returns pointer
4. **SDK Parsing**: `deserializeHeaders()` parses binary format into `Headers` array
5. **User Code**: `collectHeaders()` converts to usable format with `.key` and `.value` properties

### Property Resolution

Standard properties implemented in `PropertyResolver.ts`:

- `request.method` → HTTP method (GET, POST, etc.)
- `request.path` → URL path
- `request.url` → Full URL (scheme://host/path)
- `request.host` → Host header
- `request.scheme` → "http" or "https"
- `response.code` → Status code (200, 404, etc.)
- `response.status` → Same as response.code
- `response.code_details` → Status text ("OK", "Not Found")

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
2. Configure response (status, headers, body)
3. Set properties (JSON format)
4. Click "Run All Hooks" or individual hook buttons
5. View output in the Output section

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
3. **Header Format Discovery**: Multiple iterations to match Kong SDK format
   - Tried: simple length-prefixed format ❌
   - Tried: null-terminated strings only ❌
   - Tried: count prefix without null terminators ❌
   - **Success**: Count + size array + null-terminated data ✅

### Test Binaries

- **basic-wasm-code.md**: Simple binary that logs hook invocations
  - Tests: Basic hook execution, logging
  - Status: Works perfectly

- **print-wasm-code.md**: Complex binary that parses and prints headers
  - Tests: Header serialization, property resolution, SDK integration
  - Status: Works with correct header format

## Code Quality Notes

### Strengths

- Clean modular separation of concerns
- Comprehensive error handling
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
- Verify property values are set correctly
- Check if WASM is calling unimplemented host functions

**WASM initialization fails**

- Usually non-critical if hooks still execute
- Check what host functions WASM imports vs what we provide
- Add missing functions to HostFunctions.ts if needed

**Memory errors**

- Ensure allocator is available (proxy_on_memory_allocate or malloc)
- Check memory growth in MemoryManager.hostAllocate()
- Verify pointers aren't out of bounds

## References

- [Kong Proxy-WASM AssemblyScript SDK](https://github.com/Kong/proxy-wasm-assemblyscript-sdk)
- [Proxy-WASM Spec](https://github.com/proxy-wasm/spec)
- [WebAssembly JavaScript API](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [WASI Preview1](https://github.com/WebAssembly/WASI/blob/main/legacy/preview1/docs.md)

## Contact & Context

This test runner was built for FastEdge CDN binary development. The code runs in production on nginx with a custom wasmtime host, so exact format compatibility with the Kong SDK is critical.

Last Updated: January 23, 2026
Status: Header serialization working, core features complete, ready for testing
