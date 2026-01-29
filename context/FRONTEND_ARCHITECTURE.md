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
│   │   ├── HeadersEditor.tsx # Key:value header input
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
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://example.com/api/endpoint");
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
          // Calls sendFullFlow API - executes all hooks + real HTTP fetch
          const { hookResults, finalResponse } = await sendFullFlow(url, method, hookCall);
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

### HeadersEditor.tsx (Reusable)

Text area input for headers in `key: value` format:

- Parses multi-line text input
- Converts to `Record<string, string>`
- Used by RequestForm and ResponseForm

### RequestForm.tsx

Configure request data:

- Request headers (HeadersEditor)
- Request body (textarea)
- Request trailers (HeadersEditor)

### ResponseForm.tsx

Configure response data:

- Response headers (HeadersEditor)
- Response body (textarea)
- Response trailers (HeadersEditor)

### PropertiesEditor.tsx

JSON editor for properties:

- Textarea with JSON validation
- Real-time error display
- Default properties pre-populated

### RequestTabs.tsx (Collapsible)

Configure request data with tabbed interface wrapped in CollapsiblePanel:

- **Tabs**: Headers, Body, Properties
- **Headers tab**: HeadersEditor for key:value input
- **Body tab**: Textarea for request body (JSON, XML, etc.)
- **Properties tab**: PropertiesEditor for WASM properties
- **Collapsible**: Uses CollapsiblePanel with title "Request", defaultExpanded={true}

### HookStagesPanel.tsx (Collapsible)

Tabbed interface for viewing hook execution, wrapped in CollapsiblePanel:

- **Main tabs**: One for each hook (onRequestHeaders, onRequestBody, onResponseHeaders, onResponseBody)
- **Sub-tabs**: Logs and Inputs
- **Logs view**: Shows output, return codes, errors for that hook
- **Inputs view**: Shows data available to that hook (headers, body, properties)
- **Log level selector**: Filter logs by severity
- **Collapsible**: Uses CollapsiblePanel with title "Logging", defaultExpanded={false}

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
return {
  hookResults: {
    onRequestHeaders: { logs, returnValue, error },
    onRequestBody: { logs, returnValue, error },
    onResponseHeaders: { logs, returnValue, error },
    onResponseBody: { logs, returnValue, error },
  },
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

Last Updated: January 27, 2026
