# Frontend Architecture

## Overview

The frontend is a React 19 + TypeScript application built with Vite. It provides a modern, type-safe interface for testing proxy-wasm binaries.

## Technology Stack

- **React 19.2.3**: UI framework with hooks
- **TypeScript 5.4.5**: Type safety
- **Vite 7.3.1**: Build tool and dev server
- **CSS**: Vanilla CSS (no framework)

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── WasmLoader.tsx   # File upload component
│   │   ├── DictionaryInput.tsx # Postman-style key-value editor with defaults
│   │   ├── HeadersEditor.tsx # Wrapper around DictionaryInput
│   │   ├── PropertiesEditor.tsx # JSON properties editor
│   │   ├── RequestBar.tsx   # Method + URL + Send button
│   │   ├── RequestTabs.tsx  # Collapsible request config tabs
│   │   ├── HookStagesPanel.tsx # Collapsible hook logs/inputs viewer
│   │   ├── ResponseViewer.tsx # Collapsible response display
│   │   └── CollapsiblePanel.tsx # Reusable collapsible wrapper
│   ├── hooks/
│   │   └── useWasm.ts       # WASM loading logic
│   ├── api/
│   │   └── index.ts         # Backend API client
│   ├── utils/
│   │   └── contentType.ts   # Auto content-type detection utility
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   ├── App.tsx              # Main application component
│   ├── App.css              # Global styles
│   └── main.tsx             # React entry point
├── public/                  # Static assets (empty currently)
├── index.html               # HTML entry point
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript config (extends ../tsconfig.json)
├── tsconfig.node.json       # TypeScript config for Vite
└── package.json             # type: "module"
```

## Component Architecture

### App.tsx (Main Container)

Manages global state and orchestrates all components:

```typescript
const App = () => {
  const { wasmState, loading, error, loadWasm } = useWasm();
  const [method, setMethod] = useState("POST");
  const [url, setUrl] = useState("http://localhost:8181");
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>(...);
  const [requestBody, setRequestBody] = useState(...);
  const [properties, setProperties] = useState<Record<string, string>>(...);
  const [logLevel, setLogLevel] = useState(0); // Trace
  const [results, setResults] = useState<Record<string, HookResult>>({});
  const [finalResponse, setFinalResponse] = useState<FinalResponse | null>(null);

  return (
    <div className="container">
      <WasmLoader onFileLoad={loadWasm} loading={loading} />
      <RequestBar
        method={method}
        url={url}
        wasmLoaded={wasmState.wasmPath !== null}
        onMethodChange={setMethod}
        onUrlChange={setUrl}
        onSend={async () => {
          // Apply auto content-type detection (Postman-like behavior)
          const finalHeaders = applyDefaultContentType(requestHeaders, requestBody);

          // Calls sendFullFlow API - executes all hooks + real HTTP fetch
          const { hookResults, finalResponse } = await sendFullFlow(
            url,
            method,
            { ...hookCall, request_headers: finalHeaders, logLevel }
          );
          setResults(hookResults);
          setFinalResponse(finalResponse);
        }}
      />
      <RequestTabs
        headers={requestHeaders}
        body={requestBody}
        properties={properties}
        onHeadersChange={setRequestHeaders}
        onBodyChange={setRequestBody}
        onPropertiesChange={setProperties}
        defaultHeaders={{
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
      <HookStagesPanel
        results={results}
        hookCall={hookCall}
        logLevel={logLevel}
        onLogLevelChange={setLogLevel}
      />
      <ResponseViewer response={finalResponse} />
    </div>
  );
};
```

### CollapsiblePanel.tsx (Reusable Component)

Reusable wrapper for collapsible sections with consistent UI:

```typescript
interface CollapsiblePanelProps {
  title: string;                  // Header text
  children: React.ReactNode;      // Panel content
  defaultExpanded?: boolean;      // Initial state (default: true)
  headerExtra?: React.ReactNode;  // Optional extra content (e.g., badges)
}

export function CollapsiblePanel({
  title,
  children,
  defaultExpanded = true,
  headerExtra,
}: CollapsiblePanelProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  return (
    <div>
      <div className="collapsible-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3>{title}</h3>
          {headerExtra}
        </div>
        <span style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </div>
      {isExpanded && children}
    </div>
  );
}
```

**Used by**: RequestTabs, HookStagesPanel, ResponseViewer

**Features**:

- Consistent expand/collapse behavior across all panels
- Rotating arrow indicator
- Optional extra header content (used by ResponseViewer for status badges)
- Configurable initial state

### WasmLoader.tsx

Handles WASM file upload:

- File input
- Loading state display
- Calls `onFileLoad(file)` when file selected

### DictionaryInput.tsx (Reusable)

Postman-style tabular key-value editor with enable/disable checkboxes and default values support:

**Purpose:**

- Replace text-area based editing with visual tabular layout
- Allow temporarily disabling key-value pairs without deletion
- Provide preset default values (like Postman's default headers)
- Support per-row placeholders for contextual hints

**Features:**

- **Grid layout**: Checkbox | Key | Value | Delete button
- **Enable/disable**: Checkbox in first column to toggle rows
- **Default values**: Pre-populated suggestions that can be enabled/disabled
- **Per-row placeholders**: Contextual hints specific to each default
- **Auto-row addition**: Empty row added when typing in last row
- **Delete button**: ✕ icon removes row (maintains at least one empty row)
- **Visual feedback**: Disabled rows show at 50% opacity

**Props:**

```typescript
export type DefaultValue =
  | string
  | { value: string; enabled?: boolean; placeholder?: string };

interface DictionaryInputProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  defaultValues?: Record<string, DefaultValue>; // NEW: Preset headers/values
}
```

**DefaultValue Formats:**

```typescript
// Simple string
{ host: "example.com" }

// With enabled state
{ "content-type": { value: "", enabled: false } }

// With placeholder
{
  Authorization: {
    value: "",
    enabled: false,
    placeholder: "Bearer <token>"
  }
}
```

**Internal State:**

```typescript
interface Row {
  id: string; // crypto.randomUUID()
  key: string;
  value: string;
  enabled: boolean; // Checkbox state
  placeholder?: string; // Optional per-row placeholder
}
```

**State Management:**

- Uses lazy initializer: `useState(() => parseValue(value))`
- No `useEffect` dependency on `value` prop (prevents re-initialization)
- Preserves enabled/disabled state across parent updates
- Default values appear first, followed by user-added rows

**CSS Classes:**

- `.dictionary-input`: Container
- `.dictionary-header`: Column labels row (4-column grid: 32px | 1fr | 1fr | 40px)
- `.dictionary-row`: Data row (same grid structure)
- `.dictionary-enabled`: Checkbox column
- `.dictionary-key`, `.dictionary-value`: Input fields
- `.dictionary-delete`: Delete button (✕)

**Bug Fix History:**

Previously had a critical bug where `useEffect([value])` would re-initialize rows on every parent update, losing the enabled state. Fixed by:

1. Removing `value` from dependencies
2. Using lazy initializer in `useState`
3. Only initializing once on mount

### HeadersEditor.tsx (Reusable)

Simplified wrapper around DictionaryInput with default headers support:

```typescript
interface HeadersEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  defaultHeaders?: Record<string, DefaultValue>;
}

export const HeadersEditor = ({ value, onChange, defaultHeaders }: Props) => (
  <DictionaryInput
    value={value}
    onChange={onChange}
    keyPlaceholder="Header name"
    valuePlaceholder="Header value"
    defaultValues={defaultHeaders}
  />
);
```

Previously was a text area for `key: value` format. Now uses DictionaryInput for Postman-style editing.

### RequestForm.tsx

Configure request data:

- Request headers (HeadersEditor → DictionaryInput)
- Request body (textarea)
- Request trailers (HeadersEditor → DictionaryInput)

### ResponseForm.tsx

Configure response data:

- Response headers (HeadersEditor → DictionaryInput)
- Response body (textarea)
- Response trailers (HeadersEditor → DictionaryInput)

### PropertiesEditor.tsx

JSON editor for properties:

- Textarea with JSON validation
- Real-time error display
- Default properties pre-populated

### RequestTabs.tsx (Collapsible)

Configure request data with tabbed interface wrapped in CollapsiblePanel:

- **Tabs**: Headers, Body, Properties
- **Headers tab**: HeadersEditor for key:value input with default headers support
- **Body tab**: Textarea for request body (JSON, XML, etc.)
- **Properties tab**: PropertiesEditor for WASM properties
- **Collapsible**: Uses CollapsiblePanel with title "Request", defaultExpanded={true}
- **Default headers**: Can pass `defaultHeaders` prop to provide preset suggestions

**Default Headers Example:**

```typescript
<RequestTabs
  headers={headers}
  onHeadersChange={setHeaders}
  defaultHeaders={{
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

### HookStagesPanel.tsx (Collapsible)

Three-tab interface for comprehensive hook execution inspection, wrapped in CollapsiblePanel:

- **Main tabs**: One for each hook (onRequestHeaders, onRequestBody, onResponseHeaders, onResponseBody)
- **Sub-tabs**: Logs, Inputs, and Outputs
  - **Logs**: Shows WASM execution output, return codes, and errors for that hook
  - **Inputs**: Shows data received by the hook BEFORE WASM modifications (server-side captured state)
  - **Outputs**: Shows data produced by the hook AFTER WASM modifications (server-side captured state)
- **Log level selector**: Filter logs by severity (Trace, Debug, Info, Warn, Error, Critical)
- **Collapsible**: Uses CollapsiblePanel with title "Logging", defaultExpanded={false}

**Input/Output Separation:**

The panel displays true server-side state for both inputs and outputs:

- **Inputs tab**: Shows what the hook actually received (e.g., original headers without WASM-added headers)
- **Outputs tab**: Shows what the hook produced (e.g., headers with WASM-added custom headers)

**Example for onRequestHeaders:**

- **Inputs**: `{"content-type": "application/json", "host": "example.com"}`
- **Outputs**: `{"content-type": "application/json", "host": "example.com", "x-custom-request": "I am injected from onRequestHeaders"}`

**JSON Formatting:**

Body content is automatically prettified when `content-type` is `application/json`:

```typescript
const formatBody = (body: string, headers: Record<string, string>): string => {
  const contentType =
    Object.entries(headers).find(
      ([key]) => key.toLowerCase() === "content-type",
    )?.[1] || "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
};
```

**Response Hook Context:**

For `onResponseHeaders` and `onResponseBody`, the Inputs tab shows:

- Response headers/body that the hook received
- Modified request headers from previous hooks (visible in separate section)
- This provides complete context of what data was available during hook execution

### ResponseViewer.tsx (Collapsible)

Displays final HTTP response after all WASM processing, wrapped in CollapsiblePanel:

- **Body tab**: Formatted text display
  - JSON: Pretty-printed with 2-space indent
  - HTML: Formatted with proper indentation
  - XML: Formatted with proper indentation
  - Plain text: As-is
  - Hidden for binary content
- **Preview tab**: Visual rendering
  - HTML: Rendered in sandboxed iframe
  - Images: Displayed with proper base64 decoding
  - Other: "Preview not available" message
  - Hidden for non-visual content (JSON, plain text, etc.)
- **Headers tab**: Final response headers as key-value pairs
- **Status display**: Color-coded HTTP status and content-type in header
- **Smart defaults**: Auto-selects appropriate tab based on content type
- **Collapsible**: Uses CollapsiblePanel with title "Response", status/contentType in headerExtra, defaultExpanded={true}

### RequestBar.tsx

Top navigation bar with integrated styling:

- HTTP method dropdown (GET, POST) - integrated with URL input
- URL input field - shares focus border with method selector
- **"Send" button**: Triggers full flow execution (all hooks + HTTP fetch)
- Disabled when WASM not loaded
- Custom styling removes orange focus borders

## State Management

State is managed using React hooks:

- **useState**: Local component state
- **useWasm**: Custom hook for WASM file handling

No external state management library (Redux, Zustand, etc.) - kept simple with prop drilling.

## API Layer

### API Client (`api/index.ts`)

Two main functions:

#### uploadWasm(file: File): Promise<string>

```typescript
// 1. Read file as ArrayBuffer
const buffer = await file.arrayBuffer();

// 2. Convert to base64
const base64 = btoa(
  new Uint8Array(buffer).reduce(
    (data, byte) => data + String.fromCharCode(byte),
    "",
  ),
);

// 3. POST to /api/load
const response = await fetch("/api/load", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wasmBase64: base64 }),
});

// 4. Return filename as "path"
return file.name;
```

#### callHook(hook: string, params: HookCall): Promise<HookResult>

Calls a single hook individually (used for manual hook testing):

```typescript
const payload = { hook, request, response, properties, logLevel };
const response = await fetch("/api/call", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const result = await response.json();
return {
  logs: result.result.logs.map((log) => log.message).join("\n"),
  returnValue: result.result.returnCode,
  error: result.error,
};
```

#### sendFullFlow(url: string, method: string, params: HookCall): Promise<FullFlowResult>

Executes complete request flow with real HTTP fetch:

```typescript
// 1. Send full flow request
const payload = {
  url,
  request: {
    headers: params.request_headers || {},
    body: params.request_body || "",
    method: method || "GET",
  },
  response: { headers: {}, body: "" }, // Initial, will be replaced by real response
  properties: params.properties || {},
  logLevel: params.logLevel !== undefined ? params.logLevel : 0,
};

const response = await fetch("/api/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

// 2. Parse response with hook results and final response
const result = await response.json();

// Transform hook results with input/output data
const hookResults: Record<string, HookResult> = {};
for (const [hook, hookResult] of Object.entries(result.hookResults || {})) {
  const hr = hookResult as any;
  const logs = hr?.logs || [];
  hookResults[hook] = {
    logs: logs.map((log: any) => log.message || String(log)).join("\n"),
    returnValue: hr?.returnCode,
    error: hr?.error,
    input: hr?.input, // What hook received (before WASM)
    output: hr?.output, // What hook produced (after WASM)
    properties: hr?.properties,
  };
}

return {
  hookResults,
  finalResponse: {
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    body: "...",
    contentType: "application/json",
    isBase64: false,
  },
};
```

**Input/Output Tracking:**

Each hook result now includes both `input` and `output` fields captured by the backend:

- `input`: Data state BEFORE the hook executed (what was provided to WASM)
- `output`: Data state AFTER the hook executed (what WASM produced)

This enables the frontend to show:

- **Inputs tab**: Original data received by hook
- **Outputs tab**: Modified data produced by hook
- Clear visibility into WASM modifications

## Type System

### Frontend Types (`types/index.ts`)

```typescript
export interface HookCall {
  request_headers?: Record<string, string>;
  request_body?: string;
  request_trailers?: Record<string, string>;
  response_headers?: Record<string, string>;
  response_body?: string;
  response_trailers?: Record<string, string>;
  properties?: Record<string, string>;
  logLevel?: number;
}

export interface HookResult {
  logs: string;
  returnValue?: number;
  error?: string;
  input?: {
    request: {
      headers: Record<string, string>;
      body: string;
    };
    response: {
      headers: Record<string, string>;
      body: string;
    };
  };
  output?: {
    request: {
      headers: Record<string, string>;
      body: string;
    };
    response: {
      headers: Record<string, string>;
      body: string;
    };
  };
  properties?: Record<string, unknown>;
}

export interface WasmState {
  wasmPath: string | null;
  wasmBuffer: ArrayBuffer | null;
}
```

### Backend API Format

Request:

```json
{
  "hook": "onRequestHeaders",
  "request": {
    "headers": { "host": "example.com" },
    "body": "",
    "trailers": {}
  },
  "response": {
    "headers": { "content-type": "application/json" },
    "body": "",
    "trailers": {}
  },
  "properties": { "my.custom.property": "value" },
  "logLevel": 2
}
```

Response:

```json
{
  "ok": true,
  "result": {
    "returnCode": 0,
    "logs": [
      {"level": 2, "message": "onRequestHeaders >> info"},
      {"level": 1, "message": "#header -> host: example.com"}
    ],
    "request": {"headers": {...}, "body": ""},
    "response": {"headers": {...}, "body": ""}
  }
}
```

## Build Configuration

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5179", // Backend server
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../dist/frontend", // Output to dist/frontend directory
  },
});
```

### Development Server

In dev mode (`pnpm run dev:frontend`):

- Vite dev server runs on port 5173
- Proxies `/api/*` requests to backend on port 5179
- Hot module replacement (HMR) enabled
- Fast refresh for React components

### Production Build

In production (`pnpm run build:frontend`):

- Builds to `../dist/frontend/`
- Express serves static files from `dist/frontend/`
- SPA fallback: all non-API routes serve `index.html`

## TypeScript Configuration

### frontend/tsconfig.json

```json
{
  "extends": "../tsconfig.json", // Inherits base config
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "noEmit": true // Vite handles compilation
    // ... other options
  }
}
```

### Base tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "Node"
  }
}
```

## Utilities

### contentType.ts (`utils/contentType.ts`)

Utility function for automatic content-type detection (Postman-like behavior):

```typescript
/**
 * Applies default content-type header based on request body content if not already set.
 * Mimics Postman's automatic content-type detection behavior.
 */
export function applyDefaultContentType(
  headers: Record<string, string>,
  body: string,
): Record<string, string> {
  const finalHeaders = { ...headers };

  // Only auto-calculate if content-type is not present in headers
  if (!finalHeaders["content-type"] && body.trim()) {
    const trimmedBody = body.trim();
    const lowerBody = trimmedBody.toLowerCase();

    // Try to detect content type from body
    if (trimmedBody.startsWith("{") || trimmedBody.startsWith("[")) {
      finalHeaders["content-type"] = "application/json";
    } else if (
      lowerBody.startsWith("<!doctype html") ||
      lowerBody.startsWith("<html")
    ) {
      finalHeaders["content-type"] = "text/html";
    } else if (trimmedBody.startsWith("<?xml")) {
      finalHeaders["content-type"] = "application/xml";
    } else if (trimmedBody.startsWith("<")) {
      // Generic XML/HTML - default to HTML as it's more common in testing
      finalHeaders["content-type"] = "text/html";
    } else {
      finalHeaders["content-type"] = "text/plain";
    }
  }

  return finalHeaders;
}
```

**Detection Priority:**

1. User-set header (never override)
2. JSON: `{` or `[`
3. HTML DOCTYPE: `<!doctype html`
4. HTML tag: `<html`
5. XML declaration: `<?xml`
6. Generic markup: `<`
7. Plain text: fallback

**Usage in App.tsx:**

```typescript
const finalHeaders = applyDefaultContentType(requestHeaders, requestBody);
await sendFullFlow(url, method, { ...hookCall, request_headers: finalHeaders });
```

## Styling

Simple CSS in `App.css`:

- Container with max-width
- Section spacing
- Form elements styling
- Button styles with hover states
- Grid layout for hooks panel
- Pre-formatted output display
- Error messages in red

No CSS framework (Bootstrap, Tailwind, etc.) - kept minimal and custom.

## Development Workflow

### Local Development

1. Terminal 1: Backend

   ```bash
   pnpm run dev:backend
   # Builds TypeScript, runs with --watch
   # Server on http://localhost:5179
   ```

2. Terminal 2: Frontend

   ```bash
   pnpm run dev:frontend
   # Vite dev server on http://localhost:5173
   # Proxies API calls to :5179
   ```

3. Open browser to http://localhost:5173
4. Edit React components → instant HMR
5. Edit backend code → auto-restart

### Production Build

```bash
pnpm run build
# Builds backend → dist/
# Builds frontend → dist/frontend/

pnpm start
# Serves on http://localhost:5179
# Serves frontend from dist/frontend/
```

## Key Differences from Old Vanilla JS Frontend

### Before (Vanilla JS)

- Single `app.js` file (~180 lines)
- Manual DOM manipulation
- String-based templates
- No type safety
- Global event listeners
- Direct fetch calls throughout

### After (React + TypeScript)

- Component-based architecture
- Declarative UI
- JSX templates
- Full type safety
- Component-scoped logic
- Centralized API layer
- Reusable components (HeadersEditor)
- Better state management
- Development server with HMR

## Future Enhancements

### Potential Improvements

1. **State Management**: Add Zustand for complex state
2. **Testing**: Add Vitest for unit tests
3. **Styling**: Consider Tailwind CSS or styled-components
4. **Validation**: Add Zod for runtime type validation
5. **Error Handling**: Add React Error Boundaries
6. **Persistence**: Save test configurations to localStorage
7. **Import/Export**: Save/load test scenarios as JSON
8. **Code Splitting**: Lazy load components
9. **Accessibility**: Improve ARIA labels and keyboard navigation
10. **Dark Mode**: Add theme toggle

## Notes

- Vite requires Node.js 20.19+ or 22.12+ (currently warns about 20.12.2)
- Frontend package.json has `"type": "module"` for ESM support
- No `node_modules` in frontend/ - uses parent's via pnpm
- Build output goes to parent directory for easier deployment
- Backend serves both API and static frontend (single server deployment)
- **G-Core SDK quirk**: Returns empty string `""` for missing headers, not `null`
- Content-type detection runs only when header not explicitly set by user
- Default headers support three formats: string, {value, enabled}, {value, enabled, placeholder}
- **Input/Output tracking**: Backend captures state before and after each hook execution
- **JSON prettification**: Automatic formatting for JSON bodies based on content-type header
- **Three-tab interface**: Logs (execution output), Inputs (before WASM), Outputs (after WASM)

Last Updated: January 30, 2026
