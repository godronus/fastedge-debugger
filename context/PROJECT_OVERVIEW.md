# Proxy-WASM Test Runner - Project Overview

**📖 For detailed information, see [PROJECT_DETAILS.md](./PROJECT_DETAILS.md)**

---

## Project Goal

Build a Postman-like test runner for debugging WASM binaries that run on FastEdge. The runner supports both **Proxy-WASM (CDN apps)** and **HTTP WASM (component model)**, allowing developers to:

- Load proxy-wasm WASM binaries compiled from AssemblyScript (CDN apps)
- Load HTTP WASM component model binaries with wasi-http interface
- Send simulated HTTP requests through proxy-wasm hooks or directly to HTTP WASM
- See debug output, logs, and state changes
- Test binaries locally before deploying to production

---

## Production Context

- **Production Environment**: nginx + custom wasmtime host
- **SDK**: G-Core's proxy-wasm AssemblyScript SDK (https://github.com/G-Core/proxy-wasm-sdk-as)
- **ABI**: Standard proxy-wasm ABI with specific format requirements for the G-Core SDK
- **CDN Use Case**: Binaries run on FastEdge CDN for request/response manipulation

---

## Tech Stack

- **Backend**: Node.js + Express + TypeScript 5.4.5
- **Frontend**: React 19.2.3 + Vite 7.3.1 + TypeScript 5.4.5 + Zustand 5.0.11
- **WASM Runtime**: Node's WebAssembly API with WASI preview1
- **WebSocket**: ws 8.19.0 for real-time communication
- **State Management**: Zustand 5.0.11 with Immer middleware and auto-save
- **Port**: 5179 (configurable via PORT env var)

---

## Current Status

### ✅ Core Features Working

**Proxy-WASM (CDN Apps):**
- Load WASM binaries and execute all proxy-wasm hooks
- Isolated hook execution (each hook gets fresh WASM instance)
- Real HTTP requests with WASM-modified headers, body, and properties
- Header serialization in G-Core SDK format
- Complete property system with runtime calculation
- FastEdge host functions (secrets, dictionaries, dotenv support)

**HTTP WASM (Component Model):** ✨ NEW
- Process-based runner using FastEdge-run CLI
- Simple request/response execution (no hooks)
- Port management (8100-8199 range)
- Log capture from stdout/stderr
- Dotenv support via FastEdge-run --dotenv flag

**Shared Features:**
- Log capture with client-side filtering (Trace/Debug/Info/Warn/Error/Critical)
- WebSocket real-time synchronization across clients
- Configuration save/load system (test-config.json)
- Explicit WASM type selection (http-wasm vs proxy-wasm)
- Postman-like UI with CSS Modules
- Zustand state management with auto-save

### ⚠️ Known Issues

- **Initialization hooks**: `proxy_on_vm_start` and `proxy_on_configure` fail silently
  - **Status**: Suppressed (error messages filtered)
  - **Cause**: G-Core SDK expects host environment configuration
  - **Impact**: None - hooks execute successfully, only initialization phase affected

### ⚠️ Known Limitations

- **Response streaming not implemented**: Responses are fetched completely before processing
  - Hooks receive complete body in single call with `end_of_stream=true`
  - Cannot test streaming scenarios or incremental processing
  - Works correctly for final state testing and total body modifications

### 🚧 Not Yet Implemented

- HTTP callouts (proxy_http_call)
- Shared data/queue operations
- Metrics support
- Full property path coverage (only common paths implemented)
- Request/response trailers (map types implemented but not tested)

---

## Philosophy

- **Production Parity**: Test runner must match FastEdge CDN behavior exactly
- **No Over-Engineering**: Simple solutions over complex abstractions
- **Type Safety**: TypeScript throughout (frontend + backend)
- **Modular Architecture**: Clean separation of concerns

---

## Quick Start

```bash
pnpm install
pnpm run build
pnpm start  # Server on http://localhost:5179
```

**Development mode:**
```bash
pnpm run dev:backend    # Watch mode on port 5179
pnpm run dev:frontend   # Vite dev server on port 5173 (with proxy)
```

**Debug mode:**
```bash
PROXY_RUNNER_DEBUG=1 pnpm start
```

---

## Key Documentation

**Architecture:**
- [BACKEND_ARCHITECTURE.md](./architecture/BACKEND_ARCHITECTURE.md) - Server structure and modules
- [FRONTEND_ARCHITECTURE.md](./architecture/FRONTEND_ARCHITECTURE.md) - React components and state
- [STATE_MANAGEMENT.md](./architecture/STATE_MANAGEMENT.md) - Zustand patterns

**Features:**
- [HTTP_WASM_IMPLEMENTATION.md](./features/HTTP_WASM_IMPLEMENTATION.md) - HTTP WASM runner (NEW)
- [WEBSOCKET_IMPLEMENTATION.md](./features/WEBSOCKET_IMPLEMENTATION.md) - Real-time sync
- [FASTEDGE_IMPLEMENTATION.md](./features/FASTEDGE_IMPLEMENTATION.md) - FastEdge integration
- [PROPERTY_IMPLEMENTATION_COMPLETE.md](./features/PROPERTY_IMPLEMENTATION_COMPLETE.md) - Property system

**Development:**
- [IMPLEMENTATION_GUIDE.md](./development/IMPLEMENTATION_GUIDE.md) - Coding patterns
- [TESTING_GUIDE.md](./development/TESTING_GUIDE.md) - How to test

**See [CONTEXT_INDEX.md](./CONTEXT_INDEX.md) for complete documentation map.**

---

## References

- [G-Core Proxy-WASM AssemblyScript SDK](https://github.com/G-Core/proxy-wasm-sdk-as)
- [Proxy-WASM Spec](https://github.com/proxy-wasm/spec)
- [WebAssembly JavaScript API](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [WASI Preview1](https://github.com/WebAssembly/WASI/blob/main/legacy/preview1/docs.md)

---

**Last Updated**: February 2026
**Status**: Production-ready with complete feature set
