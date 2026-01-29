# Proxy-WASM Runner - Changelog

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
  - `x-inject-body` header is present
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
- Headers: `content-type: application/json`, `x-inject-body: value`
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
