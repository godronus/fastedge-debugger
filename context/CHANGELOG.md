# Proxy-WASM Runner - Changelog

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
