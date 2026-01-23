# Implementation Guide - Deep Dive

## How the Runner Works

### Request Flow

```
UI (browser)
  ↓ POST /api/load with base64 WASM
Server (Express)
  ↓ Buffer.from(base64)
ProxyWasmRunner.load()
  ↓ WebAssembly.compile()
  ↓ WebAssembly.instantiate(imports)
  ↓ instance._start()
Ready for hook calls

UI (browser)
  ↓ POST /api/call with {hook, request, response, properties}
Server (Express)
  ↓ JSON.parse()
ProxyWasmRunner.callHook()
  ↓ Setup: normalize headers, resolve properties
  ↓ Initialize: proxy_on_vm_start, proxy_on_configure, proxy_on_context_create
  ↓ Hook: proxy_on_request_headers(context_id, header_count, end_of_stream)
WASM Execution
  ↓ User code: onRequestHeaders()
  ↓ SDK: stream_context.headers.request.get_headers()
  ↓ SDK internal: proxy_get_header_map_pairs(0, ptr_ptr, len_ptr)
Host Function
  ↓ HostFunctions.proxy_get_header_map_pairs()
  ↓ HeaderManager.serialize(headers)
  ↓ MemoryManager.writeToWasm(bytes)
  ↓ Return pointer to WASM
WASM Execution (continued)
  ↓ SDK: deserializeHeaders(buffer)
  ↓ SDK: collectHeaders() creates Header objects
  ↓ User code: iterate headers, process
  ↓ Return FilterHeadersStatusValues.Continue
ProxyWasmRunner.callHook() (completed)
  ↓ Collect logs, modified headers/body
  ↓ Return {returnCode, logs, request, response, properties}
Server → UI
  ↓ res.json({ok: true, result: {...}})
UI displays results
```

### Memory Management

**WASM Memory Layout:**

```
[0 ... module memory ...]
[... allocated by WASM ...]
[hostAllocOffset] ← Host-controlled region starts here
[... host allocations ...]
[... grows as needed ...]
```

**Allocation Strategy:**

1. Try WASM's allocator first (proxy_on_memory_allocate or malloc)
2. If that returns 0 or fails, use host allocator
3. Host allocator grows memory in 64KB pages as needed

**Reading from WASM:**

```typescript
// Direct memory view
const bytes = new Uint8Array(memory.buffer, ptr, len);

// String decoding
const str = textDecoder.decode(bytes);
```

**Writing to WASM:**

```typescript
// Allocate space
const ptr = allocate(size);

// Write bytes
const view = new Uint8Array(memory.buffer, ptr, size);
view.set(dataBytes);

// Write U32 (little-endian)
const dataView = new DataView(memory.buffer);
dataView.setUint32(ptr, value, true);
```

### Host Function Implementation Pattern

Every host function follows this pattern:

```typescript
proxy_example_function: (
  arg1: number,
  arg2: number,
  ptrPtr: number,
  lenPtr: number,
) => {
  // 1. Log the call for debugging
  this.setLastHostCall(`proxy_example_function arg1=${arg1} arg2=${arg2}`);

  // 2. Read input data from WASM memory
  const inputData = this.memory.readString(arg1, arg2);

  // 3. Process/compute result
  const result = doSomething(inputData);

  // 4. Write result back to WASM memory
  this.memory.writeStringResult(result, ptrPtr, lenPtr);

  // 5. Return status code
  return ProxyStatus.Ok;
};
```

**Pointer-to-Pointer Pattern:**
When WASM wants a result:

- WASM allocates 8 bytes for [ptr: u32, len: u32]
- WASM passes address of this space
- Host writes pointer at ptrPtr, length at lenPtr
- WASM reads back and accesses the data

### Header Serialization Details

**Why the specific format?**
The Kong SDK's `deserializeHeaders()` function expects:

1. First u32 tells it how many pairs to expect
2. Size array lets it pre-calculate offsets
3. Null terminators allow direct ArrayBuffer slicing

**Deserialization Process (SDK side):**

```typescript
function deserializeHeaders(headers: ArrayBuffer): Headers {
  // Read count
  let numheaders = Uint32Array.wrap(headers, 0, 1)[0];

  // Read size array
  let sizes = Uint32Array.wrap(headers, 4, 2 * numheaders);

  // Read data section (after size array)
  let data = headers.slice(4 + 8 * numheaders);

  let result: Headers = [];
  let dataIndex = 0;

  for (let i = 0; i < numheaders; i++) {
    let keySize = sizes[i * 2];
    let valueSize = sizes[i * 2 + 1];

    let key = data.slice(dataIndex, dataIndex + keySize);
    dataIndex += keySize + 1; // +1 for null terminator

    let value = data.slice(dataIndex, dataIndex + valueSize);
    dataIndex += valueSize + 1; // +1 for null terminator

    result.push(new HeaderPair(key, value));
  }

  return result;
}
```

### Property Resolution

**Resolution Order:**

1. Check custom properties set by user
2. Check standard properties (request._, response._)
3. Try path segment resolution (nested objects)
4. Return undefined if not found

**Path Normalization:**

```
"request.method"          → request.method
"request\0method"         → request.method
"request/method"          → request.method
```

All resolve to the same property.

**Standard Properties:**

```typescript
// Request
"request.method"      → HTTP method from UI
"request.path"        → Path from UI
"request.url"         → Computed: scheme://host/path
"request.host"        → From headers["host"]
"request.scheme"      → From UI (http/https)

// Response
"response.code"       → Status code from UI
"response.status"     → Same as response.code
"response.code_details" → Status text from UI
```

### WASI Integration

**Why WASI?**
To capture `fd_write` calls (stdout/stderr) made by WASM.

**Implementation:**

```typescript
const wasi = new WASI({ version: "preview1" });

// Override fd_write to capture output
fd_write: (fd: number, iovs: number, iovsLen: number, nwritten: number) => {
  // 1. Capture to logs
  const captured = this.memory.captureFdWrite(fd, iovs, iovsLen, nwritten);

  // 2. Also call original WASI implementation
  const original = wasiImport.fd_write;
  if (typeof original === "function") {
    try {
      return original(fd, iovs, iovsLen, nwritten);
    } catch (error) {
      // Log but don't fail
    }
  }

  // 3. Write byte count back to WASM
  if (nwritten) {
    this.memory.writeU32(nwritten, captured);
  }

  return 0;
};
```

**IOVec Structure:**

```
[iovec0: {buf_ptr: u32, buf_len: u32}]  @ iovs + 0
[iovec1: {buf_ptr: u32, buf_len: u32}]  @ iovs + 8
[iovec2: {buf_ptr: u32, buf_len: u32}]  @ iovs + 16
...
```

Each iovec points to a buffer in WASM memory. We read all of them and concatenate.

## Module Dependencies

### ProxyWasmRunner.ts

- Imports: MemoryManager, HeaderManager, PropertyResolver, HostFunctions
- Exports: ProxyWasmRunner class
- Role: Orchestrates the entire lifecycle

### HostFunctions.ts

- Imports: MemoryManager, HeaderManager, PropertyResolver, types
- Exports: HostFunctions class
- Role: Implements proxy-wasm ABI host functions

### HeaderManager.ts

- Imports: types
- Exports: HeaderManager class (static methods)
- Role: Serialize/deserialize headers in Kong SDK format

### MemoryManager.ts

- Imports: none
- Exports: MemoryManager class
- Role: Low-level WASM memory operations

### PropertyResolver.ts

- Imports: types
- Exports: PropertyResolver class
- Role: Resolve property paths to values

### types.ts

- Imports: none
- Exports: TypeScript types and enums
- Role: Shared type definitions

**Dependency Graph:**

```
ProxyWasmRunner
  ├─→ MemoryManager
  ├─→ HeaderManager ─→ types
  ├─→ PropertyResolver ─→ types
  └─→ HostFunctions
       ├─→ MemoryManager
       ├─→ HeaderManager
       ├─→ PropertyResolver
       └─→ types
```

## Adding New Host Functions

**Step 1: Add to HostFunctions.ts**

```typescript
proxy_your_function: (
  arg1: number,
  arg2: number,
  resultPtrPtr: number,
  resultLenPtr: number,
) => {
  this.setLastHostCall(`proxy_your_function arg1=${arg1} arg2=${arg2}`);

  // Your implementation
  const result = "computed value";

  this.memory.writeStringResult(result, resultPtrPtr, resultLenPtr);
  return ProxyStatus.Ok;
};
```

**Step 2: Add to imports in createImports()**

```typescript
return {
  env: {
    // ... existing functions
    proxy_your_function: this.functions.proxy_your_function,
  },
};
```

**Step 3: Test with WASM that uses it**

## Adding New Properties

**Step 1: Add to PropertyResolver.resolveStandard()**

```typescript
private resolveStandard(path: string): unknown {
  const normalizedPath = path.replace(/\0/g, ".");

  // Your new property
  if (normalizedPath === "your.property") {
    return this.computeValue();
  }

  // ... existing properties
}
```

**Step 2: Add any needed state to PropertyResolver**

```typescript
private yourValue: string = "";

setYourValue(value: string): void {
  this.yourValue = value;
}
```

**Step 3: Wire it up in ProxyWasmRunner.callHook()**

```typescript
this.propertyResolver.setYourValue(call.yourValue ?? "default");
```

## Testing Strategy

### Manual Testing

1. Load basic-wasm-code.md → verify hooks execute
2. Load print-wasm-code.md → verify headers parse
3. Test each hook individually
4. Test "Run All Hooks" flow
5. Verify logs appear correctly
6. Test with various header combinations

### Debug Techniques

1. Enable debug mode: `PROXY_RUNNER_DEBUG=1`
2. Check hex dumps of serialized data
3. Add temporary logs in specific functions
4. Use browser dev tools for frontend debugging
5. Check terminal for server-side errors

### Common Test Cases

```javascript
// Empty headers
{}

// Single header
{"host": "example.com"}

// Multiple headers
{"host": "example.com", "content-type": "application/json", "x-trace-id": "abc123"}

// Headers with special characters
{"x-custom": "value with spaces", "x-unicode": "émojis 🎉"}

// Case variations (should normalize)
{"Host": "example.com", "Content-Type": "text/plain"}
```

## Performance Considerations

### Current Performance

- Binary loading: ~100ms for small binaries
- Hook execution: ~10-50ms per hook
- Memory allocation: minimal overhead
- No significant bottlenecks for testing

### Optimization Opportunities

1. Cache compiled WebAssembly modules
2. Reuse WASM instances for multiple calls
3. Pool memory managers
4. Batch multiple hook calls

### Memory Usage

- Each loaded binary: ~500KB - 2MB
- Runtime overhead: ~5-10MB
- Grows with: number of headers, body size, property count

## Security Considerations

### Current Security

- Runs locally only (localhost:5180)
- No authentication/authorization
- No rate limiting
- No input validation on file upload

### For Production Use

Would need:

1. Authentication
2. Rate limiting
3. Input validation (WASM signature check)
4. Resource limits (memory, execution time)
5. Sandboxing
6. HTTPS
7. CORS configuration

**Note:** This is a development tool, not intended for production deployment.

## Troubleshooting Guide

### "Module not loaded" error

- Ensure you clicked "Load" and saw "Loaded successfully"
- Check browser console for errors
- Verify WASM file is valid (not corrupted)

### Headers not appearing in output

- Check debug logs for `proxy_get_header_map_pairs`
- Verify hex dump shows correct format
- Ensure WASM is calling the host function

### Unexpected return code

- Check logs for what WASM executed
- Verify input data matches expectations
- Look for trap/error messages in logs

### "unreachable" trap

- Usually in initialization (vm_start, configure)
- Often non-critical if hooks still work
- Check which host function failed
- Add missing host functions if needed

### Memory errors

- Check available memory
- Verify allocations aren't too large
- Look for pointer arithmetic errors
- Ensure proper little-endian byte order

## Extension Points

### Custom Header Formats

If you need a different header format:

1. Modify `HeaderManager.serialize()`
2. Ensure it matches your SDK's `deserializeHeaders()`
3. Test with real binaries

### Additional Hooks

To support more hooks:

1. Add case in `buildHookInvocation()`
2. Add button in UI (index.html)
3. Add handler in app.js

### Custom Properties

To add domain-specific properties:

1. Extend `PropertyResolver.resolveStandard()`
2. Add UI fields if needed
3. Document the property path

### External Data Sources

To load properties from external sources:

1. Add async methods to PropertyResolver
2. Call during initialization in ProxyWasmRunner
3. Cache results for performance

Last Updated: January 23, 2026
