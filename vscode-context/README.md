# FastEdge VSCode Extension - Context Documentation

This directory contains documentation for the [G-Core/fastedge-vscode](https://github.com/G-Core/fastedge-vscode) extension, which we're integrating with this proxy-runner project.

## Integration Goal

**Replace the debugger in fastedge-vscode with this proxy-runner to create a unified testing interface that supports both:**
- **proxy-wasm binaries** (current proxy-runner functionality)
- **wasi-http binaries** (using FastEdge-lib, to be implemented)

This will provide a Postman-like interface for testing both binary types within VSCode.

## Documentation Files

1. **[OVERVIEW.md](./OVERVIEW.md)** - High-level architecture and capabilities
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed technical architecture
3. **[CONFIGURATION.md](./CONFIGURATION.md)** - Configuration system and dotenv support
4. **[COMPILATION.md](./COMPILATION.md)** - How Rust and JS projects are compiled
5. **[DEBUG_SESSION.md](./DEBUG_SESSION.md)** - Debug adapter protocol implementation
6. **[MCP_INTEGRATION.md](./MCP_INTEGRATION.md)** - MCP server setup
7. **[INTEGRATION_PLAN.md](./INTEGRATION_PLAN.md)** - Plan for integrating with proxy-runner

## Repository Information

- **GitHub**: https://github.com/G-Core/fastedge-vscode
- **Version**: 0.1.12
- **Publisher**: g-corelabssa
- **Languages**: TypeScript
- **Package Manager**: pnpm

## Quick Links

- Package.json: `https://github.com/G-Core/fastedge-vscode/blob/main/package.json`
- Main Extension: `src/extension.ts`
- Debug Session: `src/FastEdgeDebugSession.ts`
- Rust Compiler: `src/compiler/rustBuild.ts`
- JS Compiler: `src/compiler/jsBuild.ts`

## Key Insights

The extension shares several patterns with our proxy-runner:
- WASM binary execution
- Environment variable injection
- Secrets management
- Request/response simulation
- Real-time logging

These commonalities make integration natural and straightforward.
