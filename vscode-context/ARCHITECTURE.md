# FastEdge VSCode Extension - Architecture

## Project Structure

```
fastedge-vscode/
├── src/
│   ├── extension.ts                          # Main entry point
│   ├── types.ts                              # TypeScript type definitions
│   ├── BinaryDebugConfigurationProvider.ts   # Config validation
│   ├── FastEdgeDebugAdapterDescriptorFactory.ts  # Adapter factory
│   ├── FastEdgeDebugSession.ts               # Debug protocol implementation
│   │
│   ├── autorun/                              # Auto-execution triggers
│   │   ├── index.ts
│   │   └── triggerFileHandler.ts
│   │
│   ├── commands/                             # VSCode commands
│   │   ├── index.ts
│   │   ├── codespaceSecrets.ts               # GitHub Codespaces
│   │   ├── launchJson.ts                     # Config generation
│   │   ├── mcpJson.ts                        # MCP server setup
│   │   └── runDebugger.ts                    # Debug launcher
│   │
│   ├── compiler/                             # Build system
│   │   ├── index.ts
│   │   ├── jsBuild.ts                        # JavaScript bundler
│   │   ├── rustBuild.ts                      # Rust compiler
│   │   └── rustConfig.ts                     # Rust target config
│   │
│   └── dotenv/                               # Environment files
│       └── index.ts
│
├── fastedge-cli/                             # CLI binaries
│   ├── METADATA.json                         # Version info
│   ├── fastedge-run.exe                      # Windows
│   ├── fastedge-run-darwin-arm64             # macOS
│   └── fastedge-run-linux-x64                # Linux
│
├── exampleFolder/                            # Demo projects
│   ├── js-project/
│   ├── rust-project/
│   └── workspaces/
│
├── package.json                              # Extension manifest
├── tsconfig.json                             # TypeScript config
└── README.md                                 # Documentation
```

## Core Components

### 1. Extension Activation (`extension.ts`)

**Lifecycle:**
```typescript
export function activate(context: vscode.ExtensionContext) {
  // 1. Load CLI version from METADATA.json
  const cliVersion = readMetadata();
  updateWorkspaceConfig('fastedge.cliVersion', cliVersion);

  // 2. Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('fastedge.run-file', ...),
    vscode.commands.registerCommand('fastedge.run-workspace', ...),
    vscode.commands.registerCommand('fastedge.generate-launch-json', ...),
    vscode.commands.registerCommand('fastedge.generate-mcp-json', ...),
    vscode.commands.registerCommand('fastedge.setup-codespace-secret', ...)
  );

  // 3. Register debug components
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      'fastedge',
      new FastEdgeDebugAdapterDescriptorFactory()
    ),
    vscode.debug.registerDebugConfigurationProvider(
      'fastedge',
      new BinaryDebugConfigurationProvider()
    )
  );

  // 4. Initialize auto-run handler
  initializeTriggerFileHandler(context);
}
```

### 2. Debug Configuration Provider

**Purpose:** Validates and resolves debug configurations before launch.

**Key Responsibilities:**
- Set default values (port, entrypoint mode)
- Resolve CLI path based on platform
- Prompt user for missing required settings
- Validate configuration completeness

**Flow:**
```
User presses F5
  ↓
resolveDebugConfiguration() called
  ↓
Check entrypoint (file vs workspace)
  ↓
Prompt user if ambiguous
  ↓
Set CLI path for platform
  ↓
Return resolved config
  ↓
Launch debug session
```

### 3. Debug Adapter Descriptor Factory

**Purpose:** Creates the debug adapter that communicates with VSCode.

**Implementation:**
```typescript
createDebugAdapterDescriptor(
  session: vscode.DebugSession
): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
  return new vscode.DebugAdapterInlineImplementation(
    new FastEdgeDebugSession()
  );
}
```

Uses inline implementation (runs in extension host process) rather than spawning separate process.

### 4. Debug Session (`FastEdgeDebugSession.ts`)

**Purpose:** Implements VSCode Debug Adapter Protocol.

**Key Methods:**

```typescript
class FastEdgeDebugSession extends LoggingDebugSession {
  // Called when debugger initializes
  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    // Declare capabilities (breakpoints, terminate, etc.)
  }

  // Called to configure session
  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments
  ): void {
    // Finalize configuration
  }

  // Called to launch the app
  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchConfiguration
  ): Promise<void> {
    // 1. Compile binary
    const binary = await compileActiveEditorsBinary();

    // 2. Spawn fastedge-run process
    this.process = spawn(cliPath, buildArgs(args));

    // 3. Stream output to debug console
    this.process.stdout.on('data', (data) => {
      this.sendEvent(new OutputEvent(data.toString(), 'stdout'));
    });

    // 4. Handle process exit
    this.process.on('close', (code) => {
      this.sendEvent(new TerminatedEvent());
    });
  }

  // Called to disconnect
  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): void {
    // Kill process gracefully (SIGINT then SIGKILL)
  }
}
```

## Compilation System

### Rust Build Process

```
src/compiler/rustBuild.ts
  ↓
1. Get WASI target via rustConfigWasiTarget()
2. Execute: cargo build --message-format=json --target={target}
3. Parse JSON output line-by-line
4. Find entry where:
   - reason === "compiler-artifact"
   - filenames[0].endsWith(".wasm")
5. Return WASM path
```

**Example cargo output:**
```json
{"reason":"compiler-artifact","package_id":"my-app 0.1.0","target":{"kind":["bin"]},"filenames":["/path/to/target/wasm32-wasip1/debug/my-app.wasm"],"..."}
```

### JavaScript Build Process

```
src/compiler/jsBuild.ts
  ↓
1. Determine entry point:
   - File mode: Use active file path
   - Workspace mode: Read package.json "main" field
2. Create output directory: .vscode/bin/
3. Execute: npx fastedge-build [entry] [output]
4. Output: .vscode/bin/debugger.wasm
5. Return WASM path
```

**fastedge-build** internally:
- Bundles JS/TS dependencies
- Compiles to WASM using FastEdge SDK
- Handles polyfills and runtime setup

## Command Implementations

### 1. Generate launch.json

```typescript
// commands/launchJson.ts
export async function generateLaunchJson() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const launchJsonPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'launch.json');

  const config = {
    version: "0.2.0",
    configurations: [{
      type: "fastedge",
      name: "FastEdge App",
      request: "launch",
      port: 8181,
      dotenv: false,
      env: {},
      secrets: {},
      headers: {},
      responseHeaders: {},
      geoIpHeaders: false,
      traceLogging: false
    }]
  };

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(launchJsonPath),
    Buffer.from(JSON.stringify(config, null, 2))
  );

  vscode.window.showInformationMessage('launch.json created!');
}
```

### 2. Generate mcp.json

```typescript
// commands/mcpJson.ts
export async function createMCPJson() {
  // 1. Check for existing mcp.json
  // 2. Retrieve API credentials from secure storage
  // 3. Prompt user if credentials missing
  // 4. Generate Docker command based on platform
  // 5. Write mcp.json with server configuration
  // 6. Warn user to add to .gitignore
}
```

## Type System

```typescript
// types.ts

// Language detection
type ExtLanguage = "javascript" | "rust";

// Debug context
type DebugContext = "file" | "workspace";

// Binary information
type BinaryInfo = {
  path: string;
  lang: ExtLanguage;
};

// Launch configuration
interface LaunchConfiguration {
  cliPath: string;              // Path to fastedge-run binary
  entrypoint?: DebugContext;    // File or workspace mode
  binary?: string;              // Pre-compiled binary path
  port?: number;                // Server port (default 8181)
  dotenv?: boolean | string;    // Load .env files
  env?: Record<string, string>; // Environment variables
  secrets?: Record<string, string>; // Secrets
  headers?: Record<string, string>; // Request headers
  responseHeaders?: Record<string, string>; // Response headers
  geoIpHeaders?: boolean;       // Inject geo-location
  memoryLimit?: number;         // WASM memory limit
  traceLogging?: boolean;       // Verbose logging
}

// MCP server config
interface MCPConfiguration {
  servers: Record<string, MCPServerConfiguration>;
}
```

## Process Flow

```
User Action (F5 or Command Palette)
  ↓
Command: fastedge.run-file or fastedge.run-workspace
  ↓
vscode.debug.startDebugging() called
  ↓
BinaryDebugConfigurationProvider.resolveDebugConfiguration()
  ├─ Prompt for entrypoint if needed
  ├─ Set CLI path based on platform
  └─ Return resolved config
  ↓
FastEdgeDebugAdapterDescriptorFactory.createDebugAdapterDescriptor()
  └─ Return inline adapter with FastEdgeDebugSession
  ↓
FastEdgeDebugSession.launchRequest()
  ├─ Compile binary (Rust or JS)
  ├─ Build CLI arguments from config
  ├─ Spawn fastedge-run process
  ├─ Stream stdout/stderr to debug console
  └─ Monitor process lifecycle
  ↓
Application runs at http://localhost:8181
  ↓
User stops debugging
  ↓
FastEdgeDebugSession.disconnectRequest()
  ├─ Send SIGINT to process
  ├─ Wait 1 second
  ├─ Send SIGKILL if still running
  └─ Send TerminatedEvent to VSCode
```

## Key Architectural Decisions

1. **Inline Debug Adapter**: Runs in extension host, not separate process
   - Faster startup
   - Easier debugging
   - Direct access to VSCode APIs

2. **Platform-Specific Binaries**: Includes pre-built fastedge-run for all platforms
   - No build step for users
   - Consistent behavior across OSes
   - Updated via extension updates

3. **JSON Message Format**: Uses cargo's JSON output for parsing
   - Structured data, easy to parse
   - No regex needed
   - Future-proof as cargo evolves

4. **Dotenv Hierarchy**: Clear precedence rules
   - launch.json > .env > specialized files
   - Predictable behavior
   - Easy to override

5. **MCP via Docker**: Uses containerized MCP server
   - No local installation needed
   - Consistent environment
   - Easy updates via image pulls
