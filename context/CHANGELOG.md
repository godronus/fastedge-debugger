# Proxy-WASM Runner - Changelog

## February 5, 2026 - Production Parity Headers

### Overview

Enhanced test runner to better simulate production CDN environment with browser-like default headers, automatic Host header injection, and proxy header auto-injection. Removed test-specific defaults to keep configuration clean.

### 🎯 What Was Completed

#### 1. Browser Default Headers

**Frontend Enhancement:**

Added realistic browser headers as opt-in defaults in `App.tsx`:

- **user-agent**: `Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0`
- **accept**: `text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`
- **accept-language**: `en-US,en;q=0.9`
- **accept-encoding**: `gzip, deflate, br, zstd`

All disabled by default - developers enable as needed for testing.

**Files Modified:**

- `frontend/src/App.tsx` - Updated `defaultHeaders` prop in HeadersEditor

#### 2. Host Header Auto-Injection

**Backend Enhancement:**

Automatically inject `Host` header from target URL before hooks execute:

- Extracted from URL: `hostname` or `hostname:port` (non-standard ports only)
- Only injected if not already present in request headers
- Matches browser behavior for proper host-based routing

**Frontend Enhancement:**

Changed Host header default in UI:

- Removed hardcoded `host: "example.com"`
- Changed to calculated with placeholder `<Calculated from URL>`
- Developers can still override if needed

**Files Modified:**

- `server/runner/ProxyWasmRunner.ts` - Auto-inject Host header in `callFullFlow`
- `frontend/src/App.tsx` - Updated Host header default

#### 3. Proxy Headers Auto-Injection

**Backend Enhancement:**

Automatically inject standard proxy headers before HTTP fetch:

- **x-forwarded-proto**: Extracted from URL scheme (http/https)
- **x-forwarded-port**: 443 for https, 80 for http
- **x-real-ip**: From `request.x_real_ip` property (if set)
- **x-forwarded-for**: Same as `request.x_real_ip` (if set)

These headers are added to the actual HTTP fetch request, simulating production proxy behavior.

**Files Modified:**

- `server/runner/ProxyWasmRunner.ts` - Auto-inject proxy headers before fetch

#### 4. Client IP Property

**Frontend Enhancement:**

Made `request.x_real_ip` property editable with default value:

- Default value: `203.0.113.42` (TEST-NET-3 documentation IP)
- Developers can change to test different client IPs
- Flows into x-real-ip and x-forwarded-for headers

**Files Modified:**

- `frontend/src/components/PropertiesEditor.tsx` - Made x_real_ip editable

#### 5. Test-Specific Headers Cleanup

**Frontend Cleanup:**

Removed test-specific headers from default state:

- Removed `x-inject-req-body` and `x-inject-res-body` from initial `requestHeaders`
- These headers now only come from `test-config.json` when needed
- Keeps UI clean for normal testing scenarios

**Files Modified:**

- `frontend/src/App.tsx` - Changed initial `requestHeaders` from hardcoded test headers to `{}`

#### 6. Documentation

**New Documentation File:**

Created comprehensive documentation explaining all production parity enhancements:

- Implementation details for each feature
- Code examples and test results
- Use cases and design decisions
- Testing guide

**Files Created:**

- `context/PRODUCTION_PARITY_HEADERS.md` - Complete documentation

### 💡 Motivation

Developers comparing test runner vs production environment noticed missing headers:

**Production Environment:**

```
host, user-agent, accept, accept-language, accept-encoding, content-type,
x-forwarded-host, x-forwarded-proto, x-forwarded-port, x-real-ip, x-forwarded-for
```

**Test Runner (Before):**

```
content-type, x-inject-req-body, x-inject-res-body
```

This gap made it harder to test binaries that depend on these headers (e.g., user-agent detection, client IP logic, host-based routing).

### 🎉 Result

Test runner now provides much closer production parity:

```
[INFO]: #header -> host: cdn-origin-4732724.fastedge.cdn.gc.onl
[INFO]: #header -> user-agent: Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0
[INFO]: #header -> accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
[INFO]: #header -> accept-language: en-US,en;q=0.9
[INFO]: #header -> accept-encoding: gzip, deflate, br, zstd
[INFO]: #header -> content-type: application/json
[INFO]: #header -> x-forwarded-host: cdn-origin-4732724.fastedge.cdn.gc.onl
[INFO]: #header -> x-forwarded-proto: https
[INFO]: #header -> x-forwarded-port: 443
[INFO]: #header -> x-real-ip: 203.0.113.42
[INFO]: #header -> x-forwarded-for: 203.0.113.42
```

---

## February 5, 2026 - Property System UI Integration & Request Flow

### Overview

Completed the full property system integration with UI visibility, property chaining between hooks, and URL reconstruction from modified properties. Properties now behave like headers and bodies - modifications flow through the entire request pipeline and affect the actual HTTP request.

### 🎯 What Was Completed

#### 1. Properties Display in HookStagesPanel

**Frontend Enhancement:**

Added properties display to both Inputs and Outputs tabs in HookStagesPanel:

- **Inputs Tab**: Shows `result.input.properties` - all properties before hook execution
- **Outputs Tab**: Shows `result.output.properties` with diff highlighting against input properties
- **Visual Diffs**: Green lines for added/modified properties, red for removed properties
- **Example**: When WASM changes `request.path` from `/200` to `/400`, the diff clearly shows this modification

**Files Modified:**

- `frontend/src/components/HookStagesPanel.tsx`

#### 2. Property Capture in Input/Output States

**Backend Enhancement:**

Updated ProxyWasmRunner to capture complete property state in both input and output:

- Added `properties` field to `input` and `output` objects in HookResult
- Captures merged properties (user + calculated) using `PropertyResolver.getAllProperties()`
- Both input and output states now include full property snapshot

**Files Modified:**

- `server/runner/ProxyWasmRunner.ts`
- `server/runner/types.ts` - Added `properties?` to input/output types

#### 3. getAllProperties() Method

**PropertyResolver Enhancement:**

Added method to get all properties merged with proper priority:

```typescript
getAllProperties(): Record<string, unknown> {
  const calculated = this.getCalculatedProperties();
  // User properties override calculated ones
  return { ...calculated, ...this.properties };
}
```

**Benefits:**

- Single source of truth for all properties
- Respects priority (user properties override calculated)
- Used for both input/output capture and display

**Files Modified:**

- `server/runner/PropertyResolver.ts`

#### 4. Fixed Path Overwrite Issue

**Bug Fix:**

The `setRequestMetadata()` method was overwriting correctly extracted path from URL with default `/`:

**Problem:**

```typescript
const requestPath = call.request.path ?? "/"; // Always "/" if not provided
this.propertyResolver.setRequestMetadata(
  requestHeaders,
  requestMethod,
  requestPath,
  requestScheme,
);
// Overwrites the correct "/200" extracted from URL!
```

**Solution:**

```typescript
// Made path and scheme optional parameters
setRequestMetadata(headers: HeaderMap, method: string, path?: string, scheme?: string): void {
  this.requestHeaders = headers;
  this.requestMethod = method;
  // Only update if explicitly provided and not default value
  if (path !== undefined && path !== "/") {
    this.requestPath = path;
  }
  if (scheme !== undefined) {
    this.requestScheme = scheme;
  }
}
```

**Files Modified:**

- `server/runner/PropertyResolver.ts` - Made parameters optional
- `server/runner/ProxyWasmRunner.ts` - Pass undefined instead of defaults

#### 5. Property Chaining Between Hooks

**Critical Feature:**

Implemented property chaining just like headers and bodies chain:

```typescript
// onRequestHeaders → onRequestBody
const propertiesAfterRequestHeaders = results.onRequestHeaders.properties;
results.onRequestBody = await this.callHook({
  ...call,
  properties: propertiesAfterRequestHeaders, // ✅ Pass modified properties
  hook: "onRequestBody",
});

// onRequestBody → Response hooks
const propertiesAfterRequestBody = results.onRequestBody.properties;

// Response hooks get the chained properties
results.onResponseHeaders = await this.callHook({
  ...responseCall,
  properties: propertiesAfterRequestBody, // ✅ Chain continues
  hook: "onResponseHeaders",
});
```

**Impact:**

- Property modifications in `onRequestHeaders` are visible in `onRequestBody`
- Property modifications persist through the entire request flow
- Matches production proxy-wasm behavior for property propagation

**Files Modified:**

- `server/runner/ProxyWasmRunner.ts` - All hook calls updated

#### 6. URL Reconstruction from Modified Properties

**Major Feature:**

The HTTP fetch now uses reconstructed URL from modified properties instead of original targetUrl:

```typescript
// Extract modified properties after request hooks
const modifiedScheme =
  (propertiesAfterRequestBody["request.scheme"] as string) || "https";
const modifiedHost =
  (propertiesAfterRequestBody["request.host"] as string) || "localhost";
const modifiedPath =
  (propertiesAfterRequestBody["request.path"] as string) || "/";
const modifiedQuery =
  (propertiesAfterRequestBody["request.query"] as string) || "";

// Reconstruct URL from potentially modified properties
const actualTargetUrl = `${modifiedScheme}://${modifiedHost}${modifiedPath}${modifiedQuery ? "?" + modifiedQuery : ""}`;

// Use modified URL for fetch
const response = await fetch(actualTargetUrl, fetchOptions);
```

**Impact:**

- **WASM can now redirect requests!**
- Changing `request.path` from `/200` to `/400` actually fetches from `/400`
- Can change scheme (http ↔ https)
- Can change host (server switching)
- Can modify query parameters
- **Production parity**: This is exactly how proxy-wasm works in nginx

**Files Modified:**

- `server/runner/ProxyWasmRunner.ts`

### 📦 Files Modified Summary

**Backend:**

- `server/runner/ProxyWasmRunner.ts` - Property chaining, URL reconstruction, input/output capture
- `server/runner/PropertyResolver.ts` - getAllProperties(), optional params in setRequestMetadata
- `server/runner/types.ts` - Added properties to input/output types

**Frontend:**

- `frontend/src/components/HookStagesPanel.tsx` - Display properties in Inputs/Outputs tabs

### ✅ Testing Results

**Verified Working:**

1. ✅ Properties displayed in both Inputs and Outputs tabs
2. ✅ Diff highlighting shows property modifications (green for changes)
3. ✅ Input properties show correct values (e.g., `request.path: "/200"`)
4. ✅ Output properties show modifications (e.g., `request.path: "/400"`)
5. ✅ Properties chain between hooks correctly
6. ✅ Modified properties affect actual HTTP request (URL reconstruction works)
7. ✅ Original URL and Modified URL both logged for debugging

**Example Flow:**

```
Target URL: https://www.godronus.xyz/200

onRequestHeaders:
  Input: request.path = "/200"
  WASM: set_property("request.path", "/400")
  Output: request.path = "/400"  ✅ Diff shows change

onRequestBody:
  Input: request.path = "/400"  ✅ Chained from previous hook
  Output: request.path = "/400"  (unchanged)

HTTP Fetch:
  Original URL: https://www.godronus.xyz/200
  Modified URL: https://www.godronus.xyz/400  ✅ Reconstructed from properties
  Fetching: https://www.godronus.xyz/400  ✅ Actual request uses modified path

onResponseHeaders:
  Input: request.path = "/400"  ✅ Still chained

onResponseBody:
  Input: request.path = "/400"  ✅ Persists through entire flow
```

### 🎯 Benefits

1. **Complete Property Visibility**: Developers can see exactly how WASM modifies properties at each stage
2. **Production-Accurate Testing**: Property modifications affect actual requests just like in production
3. **Request Redirection**: WASM can now change target URLs, switch backends, modify paths
4. **Debugging Support**: Diff highlighting makes it obvious when and how properties change
5. **Proper Chaining**: Properties flow through hooks like headers and bodies (consistency)

### 📝 Use Cases Now Enabled

**1. Path Rewriting:**

```typescript
// WASM can rewrite API versions
set_property("request.path", "/api/v2/users");
// Request goes to v2 instead of v1
```

**2. Backend Switching:**

```typescript
// WASM can switch hosts based on conditions
if (country === "EU") {
  set_property("request.host", "eu-backend.example.com");
}
```

**3. Protocol Enforcement:**

```typescript
// WASM can enforce HTTPS
set_property("request.scheme", "https");
```

**4. Query Parameter Modification:**

```typescript
// WASM can add/modify query parameters
set_property("request.query", "debug=true&format=json");
```

### 🔮 Future Enhancements

- Property validation UI (show which properties are valid)
- Property history/timeline view
- Export property modifications as test cases
- Property templates for common scenarios

---

## February 4, 2026 (Part 3) - Server Properties Integration Complete

### Overview

Completed full integration of server properties system with runtime property extraction from URLs, proper merging with user-provided properties, and real-time UI updates. The system now automatically extracts properties from target URLs (request.url, request.host, request.path, etc.) and makes them available to WASM via `get_property` and `set_property` calls.

### 🎯 What Was Completed

#### 1. Runtime Property Extraction from URLs

**Implementation:**

Added `extractRuntimePropertiesFromUrl(targetUrl: string)` method to PropertyResolver that automatically parses target URLs and extracts:

- `request.url` - Full URL (e.g., "https://example.com:8080/api/users.json?page=1")
- `request.host` - Hostname with port (e.g., "example.com:8080")
- `request.path` - URL pathname (e.g., "/api/users.json")
- `request.query` - Query string without ? (e.g., "page=1&limit=10")
- `request.scheme` - Protocol (e.g., "https" or "http")
- `request.extension` - File extension from path (e.g., "json", "html")
- `request.method` - HTTP method from request

**File:** `server/runner/PropertyResolver.ts`

```typescript
extractRuntimePropertiesFromUrl(targetUrl: string): void {
  try {
    const url = new URL(targetUrl);
    this.requestUrl = targetUrl;
    this.requestHost = url.hostname + (url.port ? `:${url.port}` : "");
    this.requestPath = url.pathname || "/";
    this.requestQuery = url.search.startsWith("?") ? url.search.substring(1) : url.search;
    this.requestScheme = url.protocol.replace(":", "");
    // Extract file extension...
  } catch (error) {
    // Fallback to safe defaults
  }
}
```

#### 2. Property Priority System

Properties are resolved with smart priority:

1. **User-provided properties** (highest priority)
   - From ServerPropertiesPanel in UI
   - From `properties` object in API requests
   - Examples: request.country, request.city, custom properties

2. **Runtime-calculated properties** (fallback)
   - Automatically extracted from target URL
   - Updated on every request
   - Examples: request.url, request.host, request.path

**Behavior:**

- Users can override any calculated property
- Calculated properties update with each request
- User properties are preserved across requests

**File:** `server/runner/PropertyResolver.ts`

```typescript
resolve(path: string): unknown {
  const normalizedPath = path.replace(/\0/g, ".");

  // User properties first (highest priority)
  if (Object.prototype.hasOwnProperty.call(this.properties, normalizedPath)) {
    return this.properties[normalizedPath];
  }

  // Runtime-calculated properties as fallback
  const standardValue = this.resolveStandard(normalizedPath);
  if (standardValue !== undefined) {
    return standardValue;
  }
  // ...
}
```

#### 3. Enhanced Property Resolution

Updated `resolveStandard()` to support all standard property paths:

- Request properties: url, host, path, query, scheme, extension, method
- Response properties: code, status, code_details, content_type
- Individual header access: `request.headers.{name}`, `response.headers.{name}`
- Path normalization: handles `.`, `/`, `\0` separators

#### 4. Working set_property Implementation

Enhanced `proxy_set_property` host function to actually update PropertyResolver:

**File:** `server/runner/HostFunctions.ts`

```typescript
proxy_set_property: (pathPtr, pathLen, valuePtr, valueLen) => {
  const path = this.memory.readString(pathPtr, pathLen);
  const value = this.memory.readString(valuePtr, valueLen);

  // Update the property in the resolver
  this.propertyResolver.setProperty(path, value);
  this.logDebug(`set_property: ${path} = ${value}`);
  return ProxyStatus.Ok;
};
```

**File:** `server/runner/PropertyResolver.ts`

```typescript
setProperty(path: string, value: unknown): void {
  const normalizedPath = path.replace(/\0/g, ".");
  this.properties[normalizedPath] = value;
}
```

#### 5. Integration with ProxyWasmRunner

Modified `callFullFlow()` to extract runtime properties before executing hooks:

**File:** `server/runner/ProxyWasmRunner.ts`

```typescript
async callFullFlow(call: HookCall, targetUrl: string): Promise<FullFlowResult> {
  // Extract runtime properties from target URL before executing hooks
  this.propertyResolver.extractRuntimePropertiesFromUrl(targetUrl);
  this.logDebug(`Extracted runtime properties from URL: ${targetUrl}`);

  // ... execute hooks ...

  // Return calculated properties to frontend
  const calculatedProperties = this.propertyResolver.getCalculatedProperties();

  return {
    hookResults: results,
    finalResponse: { ... },
    calculatedProperties,
  };
}
```

#### 6. Real-Time UI Property Updates

**Backend Changes:**

Added `calculatedProperties` to response types and WebSocket events:

- **Types:** Added `calculatedProperties?: Record<string, unknown>` to `FullFlowResult`
- **WebSocket:** Added `calculatedProperties` parameter to `emitRequestCompleted()`
- **Server:** Pass calculatedProperties to WebSocket events

**Files:**

- `server/runner/types.ts`
- `server/websocket/StateManager.ts`
- `server/websocket/types.ts`
- `server/server.ts`

**Frontend Changes:**

Updated to receive and merge calculated properties:

**File:** `frontend/src/api/index.ts`

```typescript
return {
  hookResults,
  finalResponse: result.finalResponse,
  calculatedProperties: result.calculatedProperties,
};
```

**File:** `frontend/src/App.tsx`

```typescript
// Handle API response
if (calculatedProperties) {
  setProperties((prev) => {
    const merged = { ...prev };
    for (const [key, value] of Object.entries(calculatedProperties)) {
      merged[key] = String(value);
    }
    return merged;
  });
}

// Handle WebSocket event
case "request_completed":
  if (event.data.calculatedProperties) {
    setProperties((prev) => {
      const merged = { ...prev };
      for (const [key, value] of Object.entries(event.data.calculatedProperties)) {
        merged[key] = String(value);
      }
      return merged;
    });
  }
```

#### 7. Fixed DictionaryInput Prop Synchronization

**Problem:** DictionaryInput used lazy initializer that only ran once, preventing UI updates when properties changed.

**Solution:** Added `useEffect` to sync internal state with prop changes:

**File:** `frontend/src/components/DictionaryInput.tsx`

```typescript
// Sync rows when value prop changes externally (e.g., from calculated properties)
useEffect(() => {
  setRows((currentRows) => {
    // Update existing rows if their key exists in new value
    const updatedRows = currentRows.map((row) => {
      if (row.key && value.hasOwnProperty(row.key)) {
        return { ...row, value: value[row.key] };
      }
      return row;
    });

    // Add any new keys from value that don't exist in current rows
    const existingKeys = new Set(currentRows.map((r) => r.key));
    const newKeys = Object.keys(value).filter((k) => !existingKeys.has(k));

    if (newKeys.length > 0) {
      // Insert new rows...
    }

    return updatedRows;
  });
}, [value, disableDelete]);
```

### 📦 Files Modified

**Backend:**

- `server/runner/PropertyResolver.ts` - Added URL extraction, setProperty, getCalculatedProperties
- `server/runner/ProxyWasmRunner.ts` - Call extractRuntimePropertiesFromUrl, return calculatedProperties
- `server/runner/HostFunctions.ts` - Enhanced proxy_set_property to update PropertyResolver
- `server/runner/types.ts` - Added calculatedProperties to FullFlowResult
- `server/websocket/StateManager.ts` - Added calculatedProperties parameter to emitRequestCompleted
- `server/websocket/types.ts` - Added calculatedProperties to RequestCompletedEvent
- `server/server.ts` - Pass calculatedProperties to WebSocket event

**Frontend:**

- `frontend/src/api/index.ts` - Return calculatedProperties from sendFullFlow
- `frontend/src/App.tsx` - Merge calculatedProperties in both API and WebSocket handlers
- `frontend/src/hooks/websocket-types.ts` - Added calculatedProperties to RequestCompletedEvent
- `frontend/src/components/DictionaryInput.tsx` - Added useEffect to sync with prop changes

**Documentation:**

- `test-config.json` - Updated property format
- `PROPERTY_TESTING.md` - Created comprehensive testing guide
- `context/BACKEND_ARCHITECTURE.md` - Marked property integration as complete
- `context/PROJECT_OVERVIEW.md` - Moved properties to working features
- `context/PROPERTY_IMPLEMENTATION_COMPLETE.md` - Created completion summary

### ✅ Testing Results

**Verified Working:**

1. ✅ Runtime properties extracted from URL on every request
2. ✅ Calculated properties populate in ServerPropertiesPanel UI
3. ✅ Properties update when URL changes between requests
4. ✅ User-provided properties preserved across requests
5. ✅ WASM can read properties via get_property
6. ✅ WASM can write properties via set_property
7. ✅ Real-time updates work via WebSocket events
8. ✅ Multi-client synchronization works correctly

**Example Test:**

```
Request 1: https://example.com:8080/api/users.json?page=1
  → UI shows: request.host=example.com:8080, request.path=/api/users.json, request.query=page=1, request.extension=json

Request 2: https://test.com/data
  → UI updates: request.host=test.com, request.path=/data, request.query=, request.extension=

User properties (country: LU, city: Luxembourg) remain unchanged ✅
```

### 🎯 Benefits

1. **Complete Property System:** Full get_property/set_property support matches production
2. **Automatic Extraction:** No manual property configuration needed for URL components
3. **Smart Merging:** User values override calculated values when provided
4. **Real-Time Updates:** Properties update instantly on every request
5. **Production Parity:** Property resolution matches nginx + FastEdge behavior
6. **Developer Experience:** Visual feedback in UI for all property values

### 📝 Usage Examples

**In WASM Code:**

```typescript
// Get runtime-calculated properties
const url = get_property("request.url");
const host = get_property("request.host");
const path = get_property("request.path");
const query = get_property("request.query");
const extension = get_property("request.extension");

// Get user-provided properties
const country = get_property("request.country");
const city = get_property("request.city");

// Access headers via properties
const contentType = get_property("request.headers.content-type");

// Set custom properties
set_property("my.custom.value", "hello world");

// Use for business logic
if (country === "US" && path.startsWith("/admin")) {
  // US admin logic
}
```

**In UI:**

1. Load WASM binary
2. Set target URL: `https://api.example.com/users?page=1`
3. Set user properties: `request.country=LU`, `request.city=Luxembourg`
4. Click "Send"
5. ServerPropertiesPanel shows both calculated and user properties
6. Change URL and click "Send" again → calculated properties update, user properties preserved

### 🔮 Future Enhancements

- Property validation (type checking, allowed values)
- Property documentation tooltips in UI
- Property history/debugging
- Network properties simulation (x_real_ip, asn) from mock data

---

## February 4, 2026 (Part 2) - Isolated Hook Execution Architecture

### Overview

Refactored WASM execution model to create completely isolated instances for each hook call. This better simulates production behavior where each hook runs in its own context, prevents state leakage between hooks, and establishes foundation for future multi-module support.

### 🎯 Architecture Change

#### Before: Shared Instance Model

- WASM compiled and instantiated once in `load()`
- Single instance reused for all hook calls
- State persisted between hooks in WASM memory
- New stream context created per hook, but same instance

**Problem:** Not production-accurate. In nginx + wasmtime, each hook has isolated state.

#### After: Isolated Instance Model

- WASM compiled once in `load()`, stored as `WebAssembly.Module`
- Fresh instance created for each hook call in `callHook()`
- Each hook starts with clean memory and internal state
- No state leakage between hooks

**Benefit:** Accurate production simulation, catches state-related bugs, enables future multi-module flows.

### 🔧 Implementation Details

#### 1. Module Storage

**Changed:**

```typescript
// OLD
private instance: WebAssembly.Instance | null = null;
private initialized = false;

// NEW
private module: WebAssembly.Module | null = null;
private instance: WebAssembly.Instance | null = null; // Transient
```

**Purpose:**

- Compilation is expensive (~50-200ms) - do once
- Instantiation is cheap (~5-20ms) - do per hook

#### 2. load() Method

**Changed:**

```typescript
async load(buffer: Buffer): Promise<void> {
  // OLD: Compiled AND instantiated
  const module = await WebAssembly.compile(buffer);
  this.instance = await WebAssembly.instantiate(module, imports);
  // ... initialization ...

  // NEW: Only compiles, stores module
  this.module = await WebAssembly.compile(new Uint8Array(buffer));
  // No instantiation - deferred until hook execution
}
```

**Impact:**

- Faster load (no initialization overhead)
- Ready for multiple isolated executions

#### 3. callHook() Method

**Added fresh instantiation per call:**

```typescript
async callHook(call: HookCall): Promise<HookResult> {
  // Create fresh instance from compiled module
  const imports = this.createImports();
  this.instance = await WebAssembly.instantiate(this.module, imports);

  // Initialize memory with new instance
  const memory = this.instance.exports.memory;
  this.memory.setMemory(memory);
  this.memory.setInstance(this.instance);

  // Run WASI initialization
  // Call _start if exported
  // Run proxy_on_vm_start, proxy_on_configure, etc.

  // ... execute hook ...

  // Clean up instance
  this.instance = null;

  return result;
}
```

**Flow per Hook:**

1. Instantiate module → fresh instance
2. Initialize memory manager
3. Run WASI + \_start
4. Run initialization hooks
5. Create stream context
6. Execute hook
7. Capture output
8. Clean up instance

#### 4. ensureInitialized() Simplification

**Changed:**

```typescript
// OLD: Checked this.initialized flag, returned early if true
if (this.initialized) return;

// NEW: Always runs (each hook has fresh instance)
// Removed this.initialized flag entirely
```

**Reason:** Each hook call has a fresh instance, so initialization always needed.

#### 5. resetState() Update

**Changed:**

```typescript
private resetState(): void {
  // ...
  // OLD: this.initialized = false;
  // NEW: this.module = null; this.instance = null;
}
```

### 📊 Performance Impact

**Per Request (4 hooks):**

- Old model: ~10-20ms overhead (shared instance)
- New model: ~30-130ms overhead (4× instantiation + initialization)
  - Instantiation: ~20-80ms total (4 × 5-20ms)
  - Initialization hooks: ~10-50ms total

**Trade-off:** ~20-110ms slower, but production-accurate testing.

### ✅ Benefits

1. **Production Parity**
   - Matches nginx + wasmtime isolated execution
   - Each hook has completely fresh state
   - No shared memory between hooks

2. **No State Leakage**
   - Internal WASM variables reset between hooks
   - Memory allocations don't accumulate
   - Catches bugs from assumed global state

3. **Better Testing**
   - Validates proper use of property resolution
   - Tests code that assumes fresh context
   - Exposes issues with persistent state assumptions

4. **Future-Ready**
   - Foundation for loading different WASM modules per hook
   - Enables mixed-module request flows
   - Supports hook-specific binary testing

### 🔮 Future Enhancements Enabled

This architecture establishes foundation for:

```typescript
// Future: Load different modules for different hooks
await runner.loadModuleForHook("onRequestHeaders", moduleA);
await runner.loadModuleForHook("onRequestBody", moduleB);
await runner.loadModuleForHook("onResponseHeaders", moduleC);

// Execute flow with mixed modules
const result = await runner.callFullFlow(call, url);
```

### 📁 Files Modified

- `server/runner/ProxyWasmRunner.ts` - Complete refactor of instance lifecycle
  - Added `module` field for compiled module storage
  - Changed `instance` to transient (per-hook lifecycle)
  - Updated `load()` to only compile, not instantiate
  - Updated `callHook()` to create fresh instance per call
  - Simplified `ensureInitialized()` (no flag needed)
  - Updated `resetState()` to clear module
  - Removed `initialized` flag

### 📝 Documentation Updates

- `context/BACKEND_ARCHITECTURE.md` - Added "Hook Execution Model" section
- `context/IMPLEMENTATION_GUIDE.md` - Added "WASM Instance Lifecycle" section

---

## February 4, 2026 (Part 1) - Initialization Error Suppression

### Overview

Suppressed expected initialization errors from G-Core SDK during `proxy_on_vm_start` and `proxy_on_configure` hook execution. These errors are harmless (hooks execute successfully) but cluttered logs with abort messages and proc_exit warnings.

### 🎯 Changes Made

#### 1. Default Configuration

**Implementation:**

- `ProxyWasmRunner.ts`: Default VM/plugin configs set to `{"test_mode": true}` instead of empty strings
- Test runner doesn't need production-style configuration (nginx.conf)
- All state (headers, bodies, properties) set via API per-test

#### 2. Initialization State Tracking

**New Flags:**

- `ProxyWasmRunner.isInitializing` - Tracks when initialization hooks are running
- `MemoryManager.isInitializing` - Passed to memory manager for filtering

**Purpose:**

- Distinguish between initialization failures (expected) and runtime errors (important)
- Suppress specific error messages during init phase only

#### 3. Error Message Suppression

**Filtered Messages:**

- **Abort messages**: Lines containing "abort:" from stdout during initialization
- **proc_exit calls**: WASI proc_exit(255) during initialization phase
- **Implementation**:
  - `MemoryManager.captureFdWrite()` filters abort messages when `isInitializing` is true
  - `proc_exit` handler skips logging exit code 255 during initialization

**Debug Logging:**

- Changed error messages to include "(expected in test mode)" notation
- Clarifies these are known, non-blocking issues

#### 4. Files Modified

- `server/runner/ProxyWasmRunner.ts` (3 changes)
  - Added `isInitializing` flag
  - Set `memory.setInitializing()` before/after init hooks
  - Updated proc_exit handler to suppress during init
  - Improved debug messages for initialization failures
- `server/runner/MemoryManager.ts` (2 changes)
  - Added `isInitializing` flag
  - Added `setInitializing()` method
  - Filter abort messages during initialization in `captureFdWrite()`

### ✅ Result

Clean log output without initialization noise:

- No "abort: Unexpected 'null'" messages during startup
- No "WASI proc_exit(255) intercepted" messages during init
- All actual hook execution logs still visible
- Runtime errors still logged normally

### 📝 Technical Background

**Why Initialization Fails:**

Per proxy-wasm spec, `proxy_on_vm_start` and `proxy_on_configure` should:

- Read VM/plugin configuration via `proxy_get_buffer_bytes`
- Return true/false to accept/reject configuration
- In production nginx: Config comes from nginx.conf at VM startup
- In test runner: State set via API per-test, configs not meaningful

G-Core SDK expects certain config structure/fields that test environment doesn't provide, causing internal null checks to fail and abort().

**Why It's Safe:**

- Errors caught in try/catch blocks in `ensureInitialized()`
- Stream context hooks (onRequestHeaders, etc.) work perfectly
- Test runner directly sets all state rather than relying on initialization
- Only affects startup phase, not actual hook execution

## January 31, 2026 - Read-Only Properties & ServerPropertiesPanel

### Overview

Added read-only support to DictionaryInput for non-editable display-only rows. Moved properties from RequestTabs to a dedicated ServerPropertiesPanel positioned above the Hooks panel. Calculated properties (request.url, request.host, etc.) are now read-only with disabled styling.

### 🎯 Changes Made

#### 1. DictionaryInput Read-Only Support

**New Feature:**

- Added `readOnly?: boolean` property to `DefaultValue` interface
- Read-only rows are non-interactive with visual disabled state
- Prevents focus, editing, and checkbox changes
- No delete button shown for read-only rows

**Behavior:**

```typescript
// Mark a row as read-only
{
  "request.url": {
    value: "",
    placeholder: "<Calculated>",
    enabled: true,
    readOnly: true  // Can't be edited or deleted
  }
}
```

**Implementation:**

- `tabIndex={-1}` prevents keyboard focus
- `readOnly` HTML attribute prevents editing
- `pointer-events: none` CSS prevents mouse interaction
- Disabled checkbox with browser's disabled styling
- 50% opacity for grayed-out appearance
- No focus outline (orange border) on read-only inputs

**Files Modified:**

- `/frontend/src/components/DictionaryInput.tsx` - Added read-only tracking and rendering
- `/frontend/src/App.css` - Added CSS rules for read-only inputs

#### 2. PropertiesEditor Calculated Properties

**Changes:**

- Marked all calculated properties as `readOnly: true`
- Changed calculated properties from `enabled: false` to `enabled: true`
- Properties like `request.url`, `request.host`, `request.path` are now checked but uneditable
- Visual distinction: Enabled but grayed out with disabled checkbox

**Calculated Properties (Read-Only):**

- `request.url` - Full request URL (calculated from target)
- `request.host` - Host header (calculated from URL)
- `request.path` - URL path (calculated from URL)
- `request.scheme` - http/https (calculated from URL)
- `request.extension` - File extension (calculated from path)
- `request.query` - Query string (calculated from URL)
- `request.x_real_ip` - Client IP (runtime)
- `request.asn` - AS number (runtime)
- `request.var` - Custom variables (runtime)

**User-Editable Properties:**

- Country presets (Luxembourg, Germany) with geo-location data
- `request.country`, `request.city`, `request.region`, etc.

**Files Modified:**

- `/frontend/src/components/PropertiesEditor.tsx` - Updated all calculated properties

#### 3. ServerPropertiesPanel Component

**New Component:**

Created dedicated collapsible panel for server properties, separate from request configuration.

**Features:**

- Title: "Server Properties"
- Default state: Collapsed (`defaultExpanded={false}`)
- Positioned between RequestTabs and HookStagesPanel
- Contains PropertiesEditor with country presets

**Component Structure:**

```typescript
export function ServerPropertiesPanel({
  properties,
  onPropertiesChange,
}: ServerPropertiesPanelProps) {
  return (
    <CollapsiblePanel title="Server Properties" defaultExpanded={false}>
      <PropertiesEditor value={properties} onChange={onPropertiesChange} />
    </CollapsiblePanel>
  );
}
```

**Files Created:**

- `/frontend/src/components/ServerPropertiesPanel.tsx` - New component

#### 4. RequestTabs Refactoring

**Changes:**

- Removed "Properties" tab from RequestTabs
- Now only contains "Headers" and "Body" tabs
- Removed `properties` and `onPropertiesChange` from props
- Removed `PropertiesEditor` import
- Simplified tab type: `type Tab = "headers" | "body"`

**Rationale:**

- Properties are server-side concerns, not request configuration
- Better organization: Request data separate from server properties
- Clearer UI hierarchy with dedicated panel

**Files Modified:**

- `/frontend/src/components/RequestTabs.tsx` - Removed properties tab
- `/frontend/src/App.tsx` - Added ServerPropertiesPanel import and usage

### 📝 UI Layout Changes

**Before:**

```
Request Bar (Method + URL + Send)
Request Panel (Headers | Body | Properties)
Hooks Panel (Logging + Results)
Response Panel
```

**After:**

```
Request Bar (Method + URL + Send)
Request Panel (Headers | Body)
Server Properties Panel (Collapsed by default)
Hooks Panel (Logging + Results)
Response Panel
```

### 🎨 CSS Changes

**New Styles:**

```css
.dictionary-key:read-only,
.dictionary-value:read-only {
  cursor: default;
  pointer-events: none;
}

.dictionary-key:read-only:focus,
.dictionary-value:read-only:focus {
  background: #252525;
  outline: none;
}
```

**Effect:**

- Read-only inputs show default cursor (not text cursor)
- Cannot be clicked or selected
- No focus outline/orange border
- Background stays dark (no highlight on attempted focus)

### 📁 Files Summary

**Created:**

- `/frontend/src/components/ServerPropertiesPanel.tsx`

**Modified:**

- `/frontend/src/components/DictionaryInput.tsx`
- `/frontend/src/components/PropertiesEditor.tsx`
- `/frontend/src/components/RequestTabs.tsx`
- `/frontend/src/App.tsx`
- `/frontend/src/App.css`

---

## January 30, 2026 (Part 4) - PropertiesEditor Country Presets & DictionaryInput Fixes

### Overview

Enhanced PropertiesEditor with country-based presets (Luxembourg, Germany) using flag icons for visual selection. Fixed multiple DictionaryInput issues including focus loss, default value handling, and delete button logic. Improved component to use simple counter-based IDs instead of crypto.randomUUID.

### 🎯 Changes Made

#### 1. PropertiesEditor Country Presets

**Features:**

- **Country selector**: Radio buttons with flag emojis (🇱🇺 Luxembourg, 🇩🇪 Germany)
- **Geo-location presets**: Pre-populated coordinates, region, continent
- **Property ordering**: Enabled properties first, disabled ones at bottom
- **Available properties**: Based on Rust constants (request.url, request.host, request.path, etc.)

**Country Presets:**

```typescript
const countryPresets = {
  luxembourg: {
    code: "LU",
    city: "Luxembourg",
    geoLat: "49.6116",
    geoLong: "6.1319",
    region: "Luxembourg",
    continent: "Europe",
  },
  germany: {
    code: "DE",
    city: "Frankfurt",
    geoLat: "50.1109",
    geoLong: "8.6821",
    region: "Hesse",
    continent: "Europe",
  },
};
```

**Available Properties:**

- `request.url`, `request.host`, `request.path`, `request.scheme`
- `request.extension`, `request.query`, `request.x_real_ip`
- `request.country`, `request.city`, `request.asn`
- `request.geo.lat`, `request.geo.long`, `request.region`
- `request.continent`, `request.country.name`, `request.var`

#### 2. DictionaryInput Major Refactor

**Critical Fixes:**

1. **Removed crypto.randomUUID**: Replaced with simple counter (`row-${++rowIdCounter}`)
   - Lighter weight, no security needed for UI keys
   - More predictable for debugging

2. **Removed useEffect on defaultValues/value**:
   - Previously caused focus loss on every keystroke
   - Default values now used ONLY for initial state
   - User can delete default rows (they don't come back)

3. **Fixed checkbox logic**:

   ```typescript
   // OLD: disabled={!row.key.trim() && !row.value.trim()}
   // NEW: disabled={!row.key.trim()}
   // Allows enabling headers with empty values (like "Authorization: ")
   ```

4. **Fixed updateParent logic**:

   ```typescript
   // OLD: if (row.enabled && row.key.trim() && row.value.trim())
   // NEW: if (row.enabled && row.key.trim())
   // Allows empty values to be included
   ```

5. **Smart delete button logic**:
   ```typescript
   disabled={
     rows.length === 1 ||
     (rows.length === index + 1 && !row.key.trim() && !row.value.trim())
   }
   // Prevents deleting the last empty entry row
   ```

**Behavior Changes:**

- Default headers (host, Authorization, content-type) can now be deleted
- Typing in inputs no longer causes focus loss
- Spaces and special characters work correctly
- Unchecked rows can still be edited
- Last empty row can't be accidentally deleted
- Enabled state preserved across all operations

**Files Modified:**

- `/frontend/src/components/DictionaryInput.tsx` - Complete refactor
- `/frontend/src/components/PropertiesEditor.tsx` - Added country presets
- `/frontend/src/App.css` - Added `.dictionary-row.no-delete` grid variant

### 📝 Documentation Updates

- Updated FRONTEND_ARCHITECTURE.md with PropertiesEditor country preset details
- Updated DictionaryInput section with new state management approach
- Documented all bug fixes and behavior changes

---

## January 30, 2026 (Part 3) - JsonDisplay Component with Smart Diff

### Overview

Created a reusable `JsonDisplay` component with intelligent JSON diffing capabilities. The component automatically parses JSON bodies, handles nested objects, and provides git-style diffs showing exactly what changed between input and output states.

### 🎯 Changes Made

#### 1. JsonDisplay Component

**Purpose:** Centralized, reusable component for rendering JSON with optional diff view.

**Features:**

- **Smart JSON rendering**: Automatically prettifies JSON with 2-space indentation
- **Git-style diffs**: When `compareWith` prop provided, shows red (removed) and green (added) lines
- **Object-level diffing**: Compares JSON structure, not just text lines (avoids trailing comma issues)
- **Nested object support**: Properly indents and formats nested objects and arrays
- **JSON string parsing**: Auto-detects and parses JSON strings (like `reqBody: "{...}"`)
- **Multi-line handling**: Each nested line gets appropriate diff marker

**Props:**

```typescript
interface JsonDisplayProps {
  data: unknown; // The JSON data to display
  compareWith?: unknown; // Optional: data to compare against (for diff view)
  title?: string; // Optional: header title
  style?: React.CSSProperties; // Optional: custom styling
}
```

**Files Created:**

- `/frontend/src/components/JsonDisplay.tsx` - React component for rendering
- `/frontend/src/utils/diff.ts` - Diff algorithms and utilities

#### 2. Diff Utility Module

**Purpose:** Separation of concerns - business logic extracted from UI component.

**Exports:**

- `DiffLine` type - Represents a line in the diff (added/removed/unchanged)
- `isPlainObject()` - Helper to check for plain objects
- `computeJsonDiff()` - Main entry point for computing diffs
- `computeLineDiff()` - Line-by-line diff using LCS algorithm
- `findLCS()` - Longest Common Subsequence implementation
- `computeObjectDiff()` - Object-level diff with smart formatting

**Key Algorithm:** Uses LCS (Longest Common Subsequence) for line-based diffing and object-level comparison for JSON objects to avoid trailing comma issues.

**Files Created:**

- `/frontend/src/utils/diff.ts`

#### 3. Enhanced HookStagesPanel

**Improvements:**

- Replaced all inline JSON rendering with `JsonDisplay` component
- Added `isJsonContent()` helper to detect JSON via content-type header
- Added `parseBodyIfJson()` to parse JSON bodies before rendering
- Both Inputs and Outputs tabs now use `JsonDisplay`
- Request/response bodies automatically parsed and prettified when JSON
- Outputs tab shows diffs for bodies, highlighting WASM modifications

**Files Changed:**

- `/frontend/src/components/HookStagesPanel.tsx`

**Example Diff Output:**

```diff
{
  "hello": "http-responder works!",
  "method": "POST",
  "reqBody": {
    "message": "Hello",
+   "x-inject-req-body": "Injected WASM value onRequestBody"
  },
  "reqHeaders": {
    "accept": "*/*",
    "content-type": "application/json",
+   "x-custom-request": "I am injected from onRequestHeaders"
  },
+ "x-inject-res-body": "Injected WASM value onResponseBody"
}
```

#### 4. ResponseViewer Integration

**Changes:**

- Uses `JsonDisplay` for JSON response bodies
- Maintains existing HTML/XML formatting
- Consistent JSON rendering across entire app

**Files Changed:**

- `/frontend/src/components/ResponseViewer.tsx`

### 📦 Technical Details

**Object-Level Diff Algorithm:**

1. Collects all keys from both objects
2. Sorts keys alphabetically for consistent display
3. For each key:
   - Key only in after → green (added)
   - Key only in before → red (removed)
   - Key in both but value changed → red (old) then green (new)
   - Key in both with same value → white (unchanged)
4. Handles nested objects by formatting with proper indentation
5. Auto-parses JSON strings that start with `{` or `[`

**Benefits:**

- **DRY principle**: Single source of truth for JSON rendering
- **Testability**: Utility functions can be unit tested independently
- **Maintainability**: Easier to update diff logic in one place
- **Reusability**: JsonDisplay can be used anywhere in the app
- **Performance**: Uses `useMemo` to cache diff computations
- **Better UX**: Clear visual indication of what changed

### 🎨 Visual Improvements

**Before:**

- JSON shown as inline strings
- No visual indication of changes
- Nested objects collapsed on one line
- JSON strings displayed as escaped text

**After:**

- Prettified JSON with proper indentation
- Green/red diff markers for changes
- Nested objects expanded with indentation
- JSON strings auto-parsed and formatted
- Multi-line values properly aligned

## January 30, 2026 (Part 2) - Input/Output Tracking & Enhanced Debugging

### Overview

Added comprehensive input/output tracking for all hooks, showing what each hook received vs. what it produced. Enhanced error messages for fetch failures and improved JSON body display formatting.

### 🎯 Changes Made

#### 1. Input/Output Separation for Hook Execution

**Problem:** The HookStagesPanel was showing the OUTPUT of hooks (modified data) in the "Inputs" tab, making it confusing to understand what data was actually provided to each hook.

**Solution:**

- Backend now captures both input state (before hook execution) and output state (after hook execution)
- Frontend displays true inputs in "Inputs" tab and modifications in new "Outputs" tab
- Each hook result now includes:
  - `input`: What the hook received (before WASM modifications)
  - `output`: What the hook produced (after WASM modifications)

**Example:** In `onRequestHeaders`:

- **Inputs** shows original headers without WASM-added headers
- **Outputs** shows modified headers WITH WASM-added headers like `x-custom-request`

**Files Changed:**

- `/server/runner/types.ts` - Updated `HookResult` type with input/output structure
- `/server/runner/ProxyWasmRunner.ts` - Capture state before and after hook execution
- `/frontend/src/types/index.ts` - Updated frontend `HookResult` type
- `/frontend/src/api/index.ts` - Pass through input/output from server
- `/frontend/src/components/HookStagesPanel.tsx` - Use input data for Inputs tab

**Type Structure:**

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

#### 2. Three-Tab Interface for Hook Inspection

**Added:** New "Outputs" tab alongside existing "Logs" and "Inputs" tabs

**Tab Purposes:**

- **Logs**: WASM execution logs and return codes
- **Inputs**: Data received by the hook (BEFORE modification)
- **Outputs**: Data produced by the hook (AFTER modification)

**Benefits:**

- Clear visibility into hook behavior
- Easy comparison of input vs output
- Understand exactly what WASM code modified

**Files Changed:**

- `/frontend/src/components/HookStagesPanel.tsx` - Added `renderOutputs()` function and "Outputs" tab

#### 3. Enhanced Fetch Error Messages

**Problem:** Fetch failures showed generic "TypeError: fetch failed" messages without useful debugging information.

**Solution:**

- Extract detailed error information including error cause
- Include HTTP method and target URL in error message
- Display full error in ResponseViewer body
- Show error in hook logs with proper context

**Error Format:**

```
Failed to fetch POST http://localhost:8181: fetch failed (cause: Error: connect ECONNREFUSED 127.0.0.1:8181)
```

**Files Changed:**

- `/server/runner/ProxyWasmRunner.ts` - Enhanced error handling in `callFullFlow()` catch block

#### 4. JSON Body Prettification

**Problem:** JSON bodies displayed as single-line strings, making them hard to read.

**Solution:**

- Auto-detect JSON content based on `content-type` header
- Parse and re-format with 2-space indentation
- Apply to both Inputs and Outputs tabs for request/response bodies
- Gracefully handle invalid JSON (display as-is)

**Before:**

```
{"hello":"http-responder works!","method":"POST","reqBody":"{\"message\": \"Hello\"}"}
```

**After:**

```json
{
  "hello": "http-responder works!",
  "method": "POST",
  "reqBody": "{\"message\": \"Hello\"}"
}
```

**Files Changed:**

- `/frontend/src/components/HookStagesPanel.tsx` - Added `formatBody()` helper function

**Implementation:**

```typescript
const formatBody = (body: string, headers: Record<string, string>): string => {
  const contentType =
    Object.entries(headers).find(
      ([key]) => key.toLowerCase() === "content-type",
    )?.[1] || "";

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  }
  return body;
};
```

#### 5. Backend Error Handling Improvements

**Changes:**

- Safe fallback for `results.onRequestBody.output.request` in error handler
- Use last known good request state when fetch fails
- Proper error propagation to response hooks
- Detailed error messages in `finalResponse.body`

**Files Changed:**

- `/server/runner/ProxyWasmRunner.ts` - Enhanced error handling with fallbacks

### 📦 Summary

**Backend Changes:**

- ✅ Input/output state capture for all hooks
- ✅ Enhanced fetch error messages with details
- ✅ Safe error handling with fallbacks
- ✅ Updated `HookResult` type structure

**Frontend Changes:**

- ✅ Three-tab interface (Logs, Inputs, Outputs)
- ✅ True input data display (before WASM modifications)
- ✅ Output data display (after WASM modifications)
- ✅ JSON body prettification
- ✅ Updated type definitions

**Developer Experience:**

- 🎯 Clear separation of input vs output
- 🎯 Better debugging with detailed error messages
- 🎯 Readable JSON formatting
- 🎯 Complete visibility into hook execution flow

## January 30, 2026 (Part 1) - Enhanced DictionaryInput & Auto Content-Type Detection

### Overview

Fixed critical DictionaryInput bugs, added defaultValues feature with preset headers support, and implemented Postman-like automatic content-type detection for request bodies.

### 🎯 Changes Made

#### 1. DictionaryInput Bug Fix - Checkbox State Preservation

**Problem:** When unchecking headers, they would disappear from the DOM entirely instead of remaining visible as disabled entries.

**Root Cause:** The `useEffect` had `[value]` in its dependency array, causing re-initialization whenever the parent updated the value prop. This reset the internal `rows` state and lost the enabled/disabled state.

**Solution:**

- Removed `[value]` from `useEffect` dependencies
- Used lazy initializer in `useState(() => parseValue(value))` instead
- Now only initializes once on mount, preserving internal state thereafter

**Files Changed:**

- `/frontend/src/components/DictionaryInput.tsx`

#### 2. DefaultValues Feature - Preset Headers with Enhanced Control

**Purpose:** Provide pre-populated header suggestions (like Postman's defaults) that users can enable/disable.

**Features:**

- Three formats supported:
  - Simple string: `"example.com"`
  - With enabled state: `{ value: "", enabled: false }`
  - With placeholder: `{ value: "", enabled: false, placeholder: "Bearer <token>" }`
- Default headers appear above user-added headers
- Each default can be individually enabled/disabled
- Per-row placeholders provide contextual hints
- Users can override default values

**Type Definition:**

```typescript
export type DefaultValue =
  | string
  | { value: string; enabled?: boolean; placeholder?: string };

interface DictionaryInputProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  defaultValues?: Record<string, DefaultValue>; // NEW
}
```

**Example Usage:**

```typescript
<DictionaryInput
  value={headers}
  onChange={setHeaders}
  defaultValues={{
    host: "example.com",
    "content-type": {
      value: "",
      enabled: false,
      placeholder: "<Calculated at runtime>",
    },
    Authorization: {
      value: "",
      enabled: false,
      placeholder: "Bearer <token>",
    },
  }}
/>
```

**Files Changed:**

- `/frontend/src/components/DictionaryInput.tsx` - Added defaultValues prop and logic
- `/frontend/src/components/HeadersEditor.tsx` - Pass through defaultHeaders
- `/frontend/src/components/RequestTabs.tsx` - Pass through defaultHeaders
- `/frontend/src/App.tsx` - Configure default headers

#### 3. Auto Content-Type Detection (Postman-like)

**Purpose:** Automatically detect and set content-type header based on request body content, matching Postman's behavior.

**Detection Logic:**

1. Only applies if content-type is NOT already set by user
2. Checks body content to determine type:
   - Starts with `{` or `[` → `application/json`
   - Starts with `<!doctype html` or `<html` → `text/html`
   - Starts with `<?xml` → `application/xml`
   - Starts with `<` → `text/html` (generic markup)
   - Otherwise → `text/plain`

**Implementation:**

```typescript
// NEW utility file
export function applyDefaultContentType(
  headers: Record<string, string>,
  body: string,
): Record<string, string> {
  const finalHeaders = { ...headers };
  if (!finalHeaders["content-type"] && body.trim()) {
    // Detection logic here
  }
  return finalHeaders;
}
```

**Files Changed:**

- `/frontend/src/utils/contentType.ts` - NEW utility module
- `/frontend/src/App.tsx` - Call `applyDefaultContentType()` before sending request

**UI Integration:**

- Content-type default header shows placeholder: `<Calculated at runtime>`
- Starts disabled by default
- User can enable and set explicit value to override auto-detection

#### 4. Backend Fix - Response Hook Header Chaining

**Problem:** Response hooks (onResponseHeaders, onResponseBody) were receiving the original request headers, not the modified headers from request hooks.

**Impact:** Response hooks couldn't see modifications made by onRequestHeaders or onRequestBody hooks.

**Solution:** Modified `ProxyWasmRunner.responseCall()` to use `modifiedRequestHeaders` and `modifiedRequestBody` instead of original values.

**Files Changed:**

- `/server/runner/ProxyWasmRunner.ts`

#### 5. SDK Behavior Investigation

**Discovery:** G-Core proxy-wasm AssemblyScript SDK returns empty string `""` for missing headers, NOT `null`.

**Details:**

- When `stream_context.headers.request.get("header-name")` is called for non-existent header
- SDK's `get_header_map_value()` returns `new ArrayBuffer(0)`
- This decodes to empty string `""`
- WASM code must check `header !== ""` instead of `header !== null`

**Impact:** User's WASM code needed updating to check for empty strings:

```typescript
// WRONG
if (injectHeader !== null) { ... }

// CORRECT
if (injectHeader && injectHeader !== "") { ... }
```

### 📦 Component Summary

**DictionaryInput.tsx** - Now production-ready with:

- ✅ Checkbox state preservation fix
- ✅ DefaultValues with enabled/disabled state
- ✅ Per-row placeholder support
- ✅ Automatic empty row addition
- ✅ Delete functionality
- ✅ Visual feedback (50% opacity for disabled)

**HeadersEditor.tsx** - Simple wrapper passing through:

- ✅ defaultHeaders prop to DictionaryInput

**RequestTabs.tsx** - Manages request configuration:

- ✅ defaultHeaders prop support

**App.tsx** - Main orchestration:

- ✅ Auto content-type detection on send
- ✅ Default headers configuration (host, content-type, Authorization)

**contentType.ts (NEW)** - Utility module:

- ✅ `applyDefaultContentType()` function
- ✅ Business logic separation from UI components

## January 29, 2026 - Critical MapType Bug Fix

### Overview

Fixed a critical bug where response header modifications by WASM were not being applied due to incorrect MapType enum values.

### 🐛 Bug Fixed

#### MapType Enum Correction

**Problem**: The MapType enum had incorrect values that didn't match the proxy-wasm specification:

```typescript
// WRONG (before)
export enum MapType {
  RequestHeaders = 0,
  ResponseHeaders = 1, // Should be 2!
}
```

**Impact**: When WASM called `proxy_add_header_map_value` with `mapType=2` to modify response headers, our code was treating it as request headers. This caused all response header modifications to be lost.

**Solution**: Corrected the enum to match the proxy-wasm spec:

```typescript
// CORRECT (after)
export enum MapType {
  RequestHeaders = 0,
  RequestTrailers = 1,
  ResponseHeaders = 2,
  ResponseTrailers = 3,
}
```

**Result**: Response header modifications (e.g., `x-custom-response`) now properly appear in the final HTTP response.

### Files Modified

- `/server/runner/types.ts` - Fixed MapType enum values
- `/server/runner/HostFunctions.ts` - Updated getHeaderMap() and setHeaderMap() to handle all four map types

## January 29, 2026 - UI Component Refactoring

### Overview

Refactored collapsible panel logic from three separate components into a single reusable CollapsiblePanel component, eliminating code duplication and improving maintainability.

### 🎯 Key Achievements

#### 1. CollapsiblePanel Component

- **Created reusable component** - Extracted collapsible header logic into standalone component
- **Props interface**:
  - `title: string` - Header text
  - `children: ReactNode` - Panel content
  - `defaultExpanded?: boolean` - Initial expanded state (default: true)
  - `headerExtra?: ReactNode` - Optional extra content in header (e.g., status badges)
- **Features**:
  - Rotating arrow indicator (▼)
  - Click-to-toggle header
  - Smooth expand/collapse
  - Consistent styling across all panels

#### 2. Panel Refactoring

- **RequestTabs.tsx** - Wrapped tabs and content in CollapsiblePanel with title "Request"
- **HookStagesPanel.tsx** - Wrapped stages in CollapsiblePanel with title "Logging", defaultExpanded={false}
- **ResponseViewer.tsx** - Wrapped response content in CollapsiblePanel with title "Response", status/contentType in headerExtra
- **Code reduction**: Eliminated ~60 lines of duplicated collapsible logic across three files
- **Consistency**: All panels now have identical expand/collapse behavior

#### 3. Benefits

- **DRY principle**: Single source of truth for collapsible behavior
- **Easier maintenance**: Changes to collapsible logic only need to be made in one place
- **Consistency**: All panels look and behave identically
- **Extensibility**: Easy to add new collapsible panels in the future

## January 27, 2026 - Major UI/UX Improvements

### Overview

Transformed the proxy-wasm runner from a simple testing tool into a full-featured, Postman-like HTTP debugging interface with real request execution and comprehensive response visualization.

### 🎯 Key Achievements

#### 1. UI Restructuring

- **Moved "Send" button to top** - Placed next to URL input in RequestBar component for better UX
- **Replaced individual hook buttons** - Removed "Run All Hooks" approach in favor of single "Send" workflow
- **Postman-inspired layout** - More intuitive request-response flow

#### 2. Hook Stages Panel

- **Created tabbed interface** replacing TriggerPanel and OutputDisplay
- **Main tabs**: One per hook (onRequestHeaders, onRequestBody, onResponseHeaders, onResponseBody)
- **Sub-tabs**: Logs and Inputs for each hook stage
- **Logs view**: Shows execution output, return codes, errors for that specific hook
- **Inputs view**: Shows data available to that hook (headers, body, properties)
- **Individual hook buttons preserved** for manual testing/debugging

#### 3. Real HTTP Fetching

- **Implemented callFullFlow()** method in ProxyWasmRunner
- **Request flow**:
  1. Execute onRequestHeaders → WASM modifies headers
  2. Execute onRequestBody → WASM modifies body
  3. Capture modifications
  4. **Perform real HTTP fetch** with modified data
  5. Execute onResponseHeaders with real response
  6. Execute onResponseBody with real response body
- **Modified headers/body from WASM hooks used in actual HTTP request**
- **Real server responses flow into response hooks**

#### 4. Response Viewer Component

- **New comprehensive response display** similar to Postman/Insomnia
- **Three tabs**:
  - **Body**: Formatted text display (JSON/HTML/XML with syntax highlighting)
  - **Preview**: Visual rendering (HTML iframe, image display)
  - **Headers**: Final response headers as key-value pairs
- **Status display**: Color-coded HTTP status and content-type badge
- **Smart tab visibility**:
  - Hide Body tab for binary content (images, PDFs)
  - Hide Preview tab for non-visual content (JSON, plain text)
  - Always show Headers tab
- **Auto tab selection**: Chooses appropriate default based on content type

#### 5. Binary Content Handling

- **Detection**: Identifies binary content by content-type
- **Backend encoding**: Converts binary responses to base64
- **isBase64 flag**: Passed to frontend for proper handling
- **Image display**: Renders images from base64 data URLs
- **PDF/binary handling**: Shows "Binary content" message, displays only headers

#### 6. Content Formatting

- **HTML formatting**: Pretty-print with proper indentation
- **XML formatting**: Proper tag indentation and structure
- **JSON formatting**: 2-space indent, syntax-valid
- **HTML preview**: Sandboxed iframe rendering
- **Image preview**: Direct display with base64 src

#### 7. Header Forwarding Fix

- **Problem**: fetch() API auto-overrides Host header based on target URL
- **Solution**: Preserve original host header as `X-Forwarded-Host`
- **Implementation**: Case-insensitive host header detection and duplication
- **Standard proxy behavior**: Physical Host (destination) + logical X-Forwarded-Host (intent)

### 📁 Files Created/Modified

#### New Components

- `/frontend/src/components/HookStagesPanel.tsx` - Tabbed hook execution viewer
- `/frontend/src/components/ResponseViewer.tsx` - Response display with Body/Preview/Headers
- `/frontend/src/components/RequestBar.tsx` - URL bar with Send button

#### Modified Backend

- `/server/runner/ProxyWasmRunner.ts`:
  - Added `callFullFlow()` method
  - Binary content detection
  - Base64 encoding for binary responses
  - X-Forwarded-Host header preservation
- `/server/runner/types.ts`:
  - Added `FullFlowResult` type
  - Added `FinalResponse` interface with isBase64 flag
- `/server/server.ts`:
  - Added `/api/send` endpoint for full flow execution

#### Modified Frontend

- `/frontend/src/App.tsx`:
  - Integrated new components
  - Added finalResponse state
  - Connected sendFullFlow API
- `/frontend/src/App.css`:
  - Extensive styling for new components
  - Tab navigation styles
  - Response viewer layout
  - Color-coded status badges
- `/frontend/src/api/index.ts`:
  - Added `sendFullFlow()` function
- `/frontend/src/types/index.ts`:
  - Added `FinalResponse` interface

#### Documentation Updates

- `/context/PROJECT_OVERVIEW.md` - Updated features, status, UI structure
- `/context/FRONTEND_ARCHITECTURE.md` - New component descriptions, API docs
- `/context/IMPLEMENTATION_GUIDE.md` - Full flow diagram, binary handling

### 🔄 Data Flow

```
User clicks "Send" button
  ↓
sendFullFlow(url, method, hookCall)
  ↓
POST /api/send
  ↓
ProxyWasmRunner.callFullFlow()
  ↓
┌─────────────────────────────────────┐
│ PHASE 1: Request Hooks              │
├─────────────────────────────────────┤
│ - onRequestHeaders()                │
│   → WASM modifies headers           │
│ - onRequestBody()                   │
│   → WASM modifies body              │
│ - Capture modifications             │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ PHASE 2: Real HTTP Fetch            │
├─────────────────────────────────────┤
│ - Binary content detection          │
│ - Host → X-Forwarded-Host           │
│ - fetch(url, modified data)         │
│ - Binary → base64 conversion        │
│ - Extract status, headers, body     │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ PHASE 3: Response Hooks             │
├─────────────────────────────────────┤
│ - onResponseHeaders(real headers)   │
│   → WASM inspects/modifies          │
│ - onResponseBody(real body)         │
│   → WASM inspects/modifies          │
│ - Capture final state               │
└─────────────────────────────────────┘
  ↓
Return {hookResults, finalResponse}
  ↓
Frontend displays:
  - HookStagesPanel: Logs/Inputs per hook
  - ResponseViewer: Body/Preview/Headers
```

### 🎨 UI/UX Improvements

**Before:**

- Separate trigger panel with "Run All Hooks" button
- Mock/simulated responses
- Single output display for all hooks
- No response visualization

**After:**

- Postman-like "Send" button in request bar
- Real HTTP requests with actual responses
- Tabbed interface with per-hook views
- Comprehensive response viewer
- Binary content support
- HTML/JSON/XML formatting
- Image preview
- Smart tab visibility

### 🐛 Issues Resolved

1. **Mock vs Real Fetch** - Now performs actual HTTP requests between hooks
2. **Response Display** - Fixed property name mismatch (results vs hookResults/finalResponse)
3. **Binary Corruption** - Fixed by using base64 encoding instead of .text()
4. **Image Display** - Now properly renders from base64 data URLs
5. **HTML Formatting** - Added pretty-print with indentation
6. **Tab Visibility** - Conditional rendering based on content type
7. **Host Header** - Preserved as X-Forwarded-Host to maintain proxy semantics

### 🧪 Testing Status

✅ **Working:**

- WASM loading and initialization
- All four hook executions
- Real HTTP fetching
- Binary content (images, PDFs)
- Text content (JSON, HTML, XML)
- Header modifications flow to fetch
- Response data flows to response hooks
- X-Forwarded-Host preservation
- Image preview rendering
- HTML preview in iframe

⚠️ **Known Issues:**

- Response body modifications by WASM not yet applied to final response
- proxy_on_vm_start/proxy_on_configure initialization errors (non-blocking)

### 📊 Code Statistics

**Backend:**

- ProxyWasmRunner.ts: ~380 lines (added callFullFlow method)
- types.ts: ~80 lines (added FullFlowResult type)

**Frontend:**

- HookStagesPanel.tsx: ~200 lines (new component)
- ResponseViewer.tsx: ~250 lines (new component)
- RequestBar.tsx: ~80 lines (new component)
- App.tsx: ~350 lines (refactored)
- App.css: ~500 lines (extensive new styles)

### 🚀 Next Steps

**Potential Improvements:**

1. Apply response body modifications from WASM to final response
2. Add more standard proxy headers (X-Forwarded-For, X-Forwarded-Proto, X-Real-IP)
3. Request/response history tracking
4. Save/load test configurations
5. Diff view for header/body modifications
6. Export test cases
7. Dark mode theme

**Performance:**

- Consider streaming for large responses
- Add response size limits/warnings
- Implement pagination for large header lists

### 💡 Technical Highlights

**Smart Content Type Detection:**

```typescript
const isBinary =
  contentType.startsWith("image/") ||
  contentType.startsWith("video/") ||
  contentType.startsWith("audio/") ||
  contentType.includes("application/octet-stream") ||
  contentType.includes("application/pdf") ||
  contentType.includes("application/zip");
```

**Conditional Tab Visibility:**

```typescript
const hasPreview =
  contentType.includes("text/html") || contentType.startsWith("image/");

const hasbody = !isBase64;
```

**X-Forwarded-Host Preservation:**

```typescript
// Find host header (case-insensitive)
const hostEntry = Object.entries(modifiedRequestHeaders).find(
  ([key]) => key.toLowerCase() === "host",
);

// Duplicate as x-forwarded-host
if (hostEntry) {
  fetchHeaders["x-forwarded-host"] = hostEntry[1];
  this.logDebug(`Added x-forwarded-host: ${hostEntry[1]}`);
}
```

### 🎓 Lessons Learned

1. **fetch() API limitations**: Can't override Host header, requires proxy header approach
2. **Binary data handling**: Must use base64 encoding to avoid corruption
3. **Component composition**: Tabbed interface provides better UX than flat panels
4. **Type safety**: TypeScript caught many issues during refactoring
5. **Content type matters**: Different content requires different rendering strategies

---

## Previous Releases

### January 23, 2026 - Header Serialization Breakthrough

- Discovered correct G-Core SDK header format
- Implemented HeaderManager with proper serialization
- Successfully tested with print-wasm-code.md binary

### January 22, 2026 - React Migration

- Migrated from vanilla JavaScript to React 19
- Added Vite build system
- TypeScript type safety throughout
- Component-based architecture

### January 20, 2026 - Modular Refactoring

- Split 942-line monolith into 6 modules
- Created HostFunctions, HeaderManager, MemoryManager, PropertyResolver
- Improved code maintainability and testability

### January 18, 2026 - Initial Implementation

- Basic WASM loading and execution
- Hook invocation framework
- Simple UI with vanilla JavaScript
- Mock response handling

---

## January 29, 2026 - Critical Bug Fixes

### Overview

Fixed critical bug preventing WASM header modifications from being applied to HTTP requests. Improved development workflow with proper watch mode.

### 🐛 Bug Fixes

#### 1. Header Modification Chaining

**Problem**: WASM was modifying headers in `onRequestHeaders`, but those modifications weren't being applied to the actual HTTP fetch.

- Each hook was receiving the **original** headers from the UI
- Modifications in `onRequestHeaders` were lost when calling `onRequestBody`
- Modified headers never reached the HTTP fetch

**Solution**: Chain header modifications between hooks

```typescript
// Pass modified headers from onRequestHeaders to onRequestBody
const headersAfterRequestHeaders = results.onRequestHeaders.request.headers;

results.onRequestBody = await this.callHook({
  ...call,
  request: {
    ...call.request,
    headers: headersAfterRequestHeaders, // ← Use modified headers
  },
  hook: "onRequestBody",
});
```

**Impact**: WASM header modifications now properly flow through to the actual HTTP request.

#### 2. TypeScript Watch Mode

**Problem**: `dev:backend` script compiled TypeScript once, then only watched the compiled JS.

- Server changes required manual restart
- Poor developer experience

**Solution**: Enable TypeScript watch mode

```json
"dev:backend": "tsc -p server/tsconfig.json --watch & node --watch dist/server.js"
```

**Impact**: Backend TypeScript files now automatically recompile and restart server on changes.

### 🧪 New Test Binary

#### change-header-code.wasm

Comprehensive test for request modification capabilities:

**Features:**

- Injects custom header: `x-custom-me: I am injected`
- Conditionally modifies request body when:
  - `x-inject-req-body` header is present
  - `content-type` is `application/json`
  - Request has a body
- Removes `content-length` header when body will be modified
- Parses and modifies JSON request body (adds field from header value)
- Uses `set_buffer_bytes` to write modified body

**Testing Setup:**

- Backend echo server on localhost:8181
- Returns all received headers and body
- Allows verification of WASM modifications

**Test Results:**
✅ Header injection working: `x-custom-me` appears in echo server response
✅ Modified headers flow through to HTTP fetch
✅ X-Forwarded-Host preserved correctly
🧪 Body modification in progress (WASM logic implemented, testing in progress)

### 📁 Files Modified

**Backend:**

- `/server/runner/ProxyWasmRunner.ts`:
  - Fixed header chaining in `callFullFlow()` method
  - Added debug logging for header flow tracking
  - Lines 97-117 updated

**Configuration:**

- `/package.json`:
  - Updated `dev:backend` script to use `--watch` flag
  - Enables automatic TypeScript recompilation

**Documentation:**

- `/context/change-header-code.md` - New WASM test source code
- `/context/backend-server.md` - Echo server documentation

### 🔍 Debug Improvements

Added debug logging for troubleshooting:

```typescript
this.logDebug(
  `Headers after onRequestHeaders: ${JSON.stringify(headersAfterRequestHeaders)}`,
);
this.logDebug(
  `Final headers for fetch: ${JSON.stringify(modifiedRequestHeaders)}`,
);
```

Enable with: `PROXY_RUNNER_DEBUG=1 pnpm start`

### 🎯 Verification

**Test Case 1: Header Injection**

- Method: GET
- URL: http://localhost:8181
- Headers: `content-type: application/json`
- Result: Echo server shows `x-custom-me: I am injected` ✅

**Test Case 2: Body Modification** (in progress)

- Method: POST
- Headers: `content-type: application/json`, `x-inject-req-body: value`
- Body: `{"message": "Hello"}`
- Expected: Body modified to include injected field

### 💡 Key Learnings

1. **Hook State Management**: Each hook must receive the accumulated state from previous hooks, not the original input
2. **Debug Logging**: Critical for tracing data flow through hook pipeline
3. **Development Workflow**: Watch mode essential for efficient development
4. **Test Infrastructure**: Echo server provides transparent verification of modifications

### 🚀 Impact

This fix enables the core use case of the proxy-wasm runner:

- WASM can now modify requests before they're sent
- Header injection works end-to-end
- Body modification infrastructure in place
- Proper development workflow established

The runner is now functioning as a true proxy, allowing WASM to transform requests before forwarding them.

---

## Previous Releases

### January 27, 2026 - Major UI/UX Improvements
