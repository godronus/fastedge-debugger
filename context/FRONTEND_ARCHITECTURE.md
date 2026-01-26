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
│   │   ├── RequestForm.tsx   # Request configuration
│   │   ├── ResponseForm.tsx  # Response configuration
│   │   ├── PropertiesEditor.tsx # JSON properties editor
│   │   ├── HooksPanel.tsx    # Hook execution controls
│   │   └── OutputDisplay.tsx # Results viewer
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
  const [requestConfig, setRequestConfig] = useState<RequestConfig>(...);
  const [responseConfig, setResponseConfig] = useState<ResponseConfig>(...);
  const [properties, setProperties] = useState<Record<string, string>>(...);
  const [logLevel, setLogLevel] = useState(2);
  const [results, setResults] = useState<Record<string, HookResult>>({});

  return (
    <div className="container">
      <WasmLoader onFileLoad={loadWasm} loading={loading} />
      <RequestForm value={requestConfig} onChange={setRequestConfig} />
      <ResponseForm value={responseConfig} onChange={setResponseConfig} />
      <PropertiesEditor value={properties} onChange={setProperties} />
      <HooksPanel
        wasmLoaded={wasmState.wasmPath !== null}
        hookCall={hookCall}
        logLevel={logLevel}
        onLogLevelChange={setLogLevel}
        onResult={handleResult}
      />
      <OutputDisplay results={results} />
    </div>
  );
};
```

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

### HooksPanel.tsx

Execute hooks:

- Log level selector (Trace to Critical)
- "Run All Hooks" button
- Individual hook buttons (grid layout)
- Supported hooks:
  - onRequestHeaders
  - onRequestBody
  - onResponseHeaders
  - onResponseBody

### OutputDisplay.tsx

Display results:

- Per-hook output sections
- Error messages (red text)
- Return codes
- Formatted logs (pre tag)

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

```typescript
// 1. Transform frontend format to backend format
const payload = {
  hook,
  request: {
    headers: params.request_headers || {},
    body: params.request_body || "",
    trailers: params.request_trailers || {},
  },
  response: {
    headers: params.response_headers || {},
    body: params.response_body || "",
    trailers: params.response_trailers || {},
  },
  properties: params.properties || {},
  logLevel: params.logLevel !== undefined ? params.logLevel : 2,
};

// 2. POST to /api/call
const response = await fetch("/api/call", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

// 3. Transform response
const result = await response.json();
const logs = result.result?.logs || [];
return {
  logs: logs.map((log: any) => log.message || String(log)).join("\n"),
  returnValue: result.result?.returnCode,
  error: result.error,
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
    outDir: "../dist-frontend", // Output to parent directory
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

- Builds to `../dist-frontend/`
- Express serves static files from `dist-frontend/`
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
# Builds frontend → dist-frontend/

pnpm start
# Serves on http://localhost:5179
# Serves frontend from dist-frontend/
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

Last Updated: January 26, 2026
