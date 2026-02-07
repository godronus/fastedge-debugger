# FastEdge VSCode Extension - Overview

## What It Does

The FastEdge VSCode Extension enables developers to compile and debug Gcore/FastEdge binaries directly within VS Code's debug interface, supporting both Rust and JavaScript/TypeScript projects.

## Key Features

### 1. Language Support
- **Rust**: Compiles to WASM using `cargo build --target wasm32-wasip1`
- **JavaScript/TypeScript**: Compiles using `fastedge-build` (npm package)

### 2. Local Development Server
- Compiled apps run at `http://localhost:8181` (configurable)
- Uses `fastedge-run` CLI binary for execution
- Platform-specific binaries: Windows (.exe), macOS (darwin-arm64), Linux (x64)

### 3. Configuration Management
- Generates `.vscode/launch.json` for debug settings
- Supports `.env` files with FastEdge-specific prefixes
- Hierarchical config: launch.json > .env > specialized env files

### 4. MCP Server Integration
- New feature: Generates `mcp.json` for FastEdge Assistant
- Uses Docker image: `ghcr.io/g-core/fastedge-mcp-server:latest`
- Stores API credentials in VSCode's secure storage

## Available Commands

1. **Debug: FastEdge App (Current File)**
   - Command: `fastedge.run-file`
   - Uses active editor's directory as working directory

2. **Debug: FastEdge App (Workspace)**
   - Command: `fastedge.run-workspace`
   - Uses entire workspace as build context

3. **Debug: FastEdge (Generate launch.json)**
   - Command: `fastedge.generate-launch-json`
   - Auto-generates debug configuration file

4. **FastEdge (Generate mcp.json)**
   - Command: `fastedge.generate-mcp-json`
   - Sets up MCP server configuration

5. **Setup Codespace Secret**
   - Command: `fastedge.setup-codespace-secret`
   - Configures GitHub Codespaces authentication

## Prerequisites

### For Rust Development
```bash
rustup target add wasm32-wasip1
```

### For JavaScript Development
```bash
npm install --save-dev @gcoredev/fastedge-sdk-js
```

## Workflow

1. **Install Extension** → From VSCode Marketplace
2. **Generate Config** → Run "FastEdge (Generate launch.json)"
3. **Write Code** → Develop in Rust or JavaScript
4. **Press F5** → Extension compiles and launches app
5. **Test Locally** → Access at `http://localhost:8181`
6. **View Logs** → Real-time output in debug console

## Configuration Options

The extension provides these launch.json settings:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | `"fastedge"` | Debugger type |
| `name` | string | `"FastEdge App"` | Display name |
| `request` | string | `"launch"` | Operation mode |
| `port` | number | `8181` | Server port |
| `dotenv` | boolean/string | `false` | Load .env files |
| `env` | object | `{}` | Environment variables |
| `secrets` | object | `{}` | Sensitive configuration |
| `headers` | object | `{}` | Request headers |
| `responseHeaders` | object | `{}` | Response headers |
| `geoIpHeaders` | boolean | `false` | Inject geo-location |
| `memoryLimit` | number | - | WASM memory limit |
| `traceLogging` | boolean | `false` | Verbose logging |

## How It Relates to Proxy-Runner

### Similarities
- Both execute WASM binaries
- Both inject environment variables and secrets
- Both handle request/response cycles
- Both provide real-time logging
- Both use similar dotenv patterns

### Key Differences
- **Extension**: Integrated into VSCode debugger UI
- **Proxy-Runner**: Standalone Postman-like web interface
- **Extension**: Uses fastedge-run CLI for execution
- **Proxy-Runner**: Uses Node.js WebAssembly API directly

### Integration Opportunity
We can replace the extension's debug session with our proxy-runner, providing:
- Better UI (Postman-like interface)
- Support for both proxy-wasm AND wasi-http binaries
- More detailed request/response inspection
- Hook-by-hook execution visibility
- Property system debugging
