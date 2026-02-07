# FastEdge VSCode Extension - Debug Session

## Debug Adapter Protocol Implementation

The extension implements the [VSCode Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) (DAP) to integrate with VSCode's debugger UI.

## FastEdgeDebugSession Class

Located in `src/FastEdgeDebugSession.ts`, extends `LoggingDebugSession` from `@vscode/debugadapter`.

### Session Lifecycle

```
User starts debugging
  ↓
1. initializeRequest()
     ↓ Declare capabilities
2. configurationDoneRequest()
     ↓ Finalize configuration
3. launchRequest()
     ↓ Compile and launch app
4. (App runs, streams output)
     ↓
5. disconnectRequest()
     ↓ Terminate process
```

## Key Methods

### 1. initializeRequest()

**Purpose:** Declare debugger capabilities to VSCode.

```typescript
protected initializeRequest(
  response: DebugProtocol.InitializeResponse,
  args: DebugProtocol.InitializeRequestArguments
): void {
  response.body = {
    ...response.body,

    // Capabilities
    supportsConfigurationDoneRequest: true,
    supportsTerminateRequest: true,
    supportsBreakpointLocationsRequest: false,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsDataBreakpoints: false,

    // More capabilities...
  };

  this.sendResponse(response);
}
```

**Capabilities declared:**
- ✅ Configuration done request
- ✅ Terminate request
- ❌ Breakpoints (not supported for WASM execution)
- ❌ Step debugging (not applicable)
- ❌ Data breakpoints

### 2. configurationDoneRequest()

**Purpose:** Signal that configuration is complete.

```typescript
protected configurationDoneRequest(
  response: DebugProtocol.ConfigurationDoneResponse,
  args: DebugProtocol.ConfigurationDoneArguments
): void {
  super.configurationDoneRequest(response, args);
  // Configuration is finalized, ready for launch
}
```

### 3. launchRequest()

**Purpose:** Main method that compiles code and launches the FastEdge runtime.

```typescript
protected async launchRequest(
  response: DebugProtocol.LaunchResponse,
  args: LaunchConfiguration
): Promise<void> {
  try {
    // Clear debug console
    this.sendEvent(new OutputEvent('\x1b[2J\x1b[H'));

    // Step 1: Compile binary
    const binary = await compileActiveEditorsBinary(
      args.entrypoint || 'file',
      (message, type) => {
        this.sendEvent(new OutputEvent(message + '\n', type));
      }
    );

    if (!binary) {
      this.sendEvent(new OutputEvent('Compilation failed\n', 'stderr'));
      this.sendEvent(new TerminatedEvent());
      return;
    }

    // Step 2: Build CLI arguments
    const cliArgs = buildCliArguments(args, binary);

    // Step 3: Spawn fastedge-run process
    this.process = spawn(args.cliPath, cliArgs, {
      cwd: args.cwd || process.cwd()
    });

    // Step 4: Stream stdout
    this.process.stdout.on('data', (data: Buffer) => {
      this.sendEvent(new OutputEvent(data.toString(), 'stdout'));
    });

    // Step 5: Stream stderr
    this.process.stderr.on('data', (data: Buffer) => {
      this.sendEvent(new OutputEvent(data.toString(), 'stderr'));
    });

    // Step 6: Handle process exit
    this.process.on('close', (code: number) => {
      this.sendEvent(new OutputEvent(
        `Process exited with code ${code}\n`,
        code === 0 ? 'stdout' : 'stderr'
      ));
      this.sendEvent(new TerminatedEvent());
    });

    this.sendResponse(response);

  } catch (error) {
    this.sendEvent(new OutputEvent(
      `Error: ${error.message}\n`,
      'stderr'
    ));
    this.sendEvent(new TerminatedEvent());
  }
}
```

### 4. disconnectRequest()

**Purpose:** Gracefully terminate the running process.

```typescript
protected disconnectRequest(
  response: DebugProtocol.DisconnectResponse,
  args: DebugProtocol.DisconnectArguments
): void {
  if (this.process) {
    // Try graceful shutdown (SIGINT)
    this.process.kill('SIGINT');

    // Force kill after 1 second if still running
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }, 1000);
  }

  this.sendResponse(response);
}
```

## CLI Argument Construction

### buildCliArguments() Implementation

```typescript
function buildCliArguments(
  config: LaunchConfiguration,
  binary: BinaryInfo
): string[] {
  const args: string[] = [];

  // Port
  if (config.port) {
    args.push('--port', config.port.toString());
  }

  // Environment variables
  if (config.env) {
    Object.entries(config.env).forEach(([key, value]) => {
      args.push('--env', `${key}=${value}`);
    });
  }

  // Secrets
  if (config.secrets) {
    Object.entries(config.secrets).forEach(([key, value]) => {
      args.push('--secret', `${key}=${value}`);
    });
  }

  // Request headers
  if (config.headers) {
    Object.entries(config.headers).forEach(([key, value]) => {
      args.push('--header', `${key}=${value}`);
    });
  }

  // Response headers
  if (config.responseHeaders) {
    Object.entries(config.responseHeaders).forEach(([key, value]) => {
      args.push('--response-header', `${key}=${value}`);
    });
  }

  // Geo-IP headers
  if (config.geoIpHeaders) {
    args.push('--geo-ip-headers');
  }

  // Memory limit
  if (config.memoryLimit) {
    args.push('--memory-limit', config.memoryLimit.toString());
  }

  // Trace logging
  if (config.traceLogging) {
    args.push('--trace');
  }

  // DotEnv
  if (config.dotenv) {
    if (typeof config.dotenv === 'string') {
      args.push('--dotenv', config.dotenv);
    } else {
      args.push('--dotenv');
    }
  }

  // Binary path (must be last argument)
  args.push(binary.path);

  return args;
}
```

### Example CLI Command

**Configuration:**
```json
{
  "port": 8181,
  "env": {"LOG_LEVEL": "debug"},
  "secrets": {"API_KEY": "secret123"},
  "headers": {"authorization": "Bearer token"},
  "geoIpHeaders": true,
  "traceLogging": true
}
```

**Generated Command:**
```bash
/path/to/fastedge-run \
  --port 8181 \
  --env LOG_LEVEL=debug \
  --secret API_KEY=secret123 \
  --header authorization="Bearer token" \
  --geo-ip-headers \
  --trace \
  /path/to/binary.wasm
```

## Output Streaming

### Console Management

The debug session streams output in real-time to VSCode's Debug Console:

```typescript
// Clear console on start (ANSI escape codes)
this.sendEvent(new OutputEvent('\x1b[2J\x1b[H'));

// Stream stdout
this.process.stdout.on('data', (data: Buffer) => {
  this.sendEvent(new OutputEvent(data.toString(), 'stdout'));
});

// Stream stderr
this.process.stderr.on('data', (data: Buffer) => {
  this.sendEvent(new OutputEvent(data.toString(), 'stderr'));
});
```

### Output Event Format

```typescript
interface OutputEvent {
  output: string;      // The text to display
  category?: string;   // 'stdout', 'stderr', 'console'
  variablesReference?: number;
  source?: Source;
  line?: number;
  column?: number;
}
```

### Example Output

```
Compiling Rust project...
    Finished dev [unoptimized + debuginfo] target(s) in 2.34s
Starting FastEdge runtime...
[INFO] Server listening on http://localhost:8181
[DEBUG] Request received: GET /
[DEBUG] Response sent: 200 OK
```

## Process Lifecycle

### Startup Sequence

```
1. User clicks debug button or presses F5
     ↓
2. VSCode calls initializeRequest()
     ↓
3. VSCode calls configurationDoneRequest()
     ↓
4. VSCode calls launchRequest()
     ↓
5. Extension compiles binary
     ↓ (Compilation output streamed to console)
6. Extension spawns fastedge-run process
     ↓
7. Process starts, stdout/stderr streamed
     ↓
8. Application serves at http://localhost:8181
     ↓
9. User can make requests, see logs in real-time
```

### Shutdown Sequence

```
1. User clicks stop button
     ↓
2. VSCode calls disconnectRequest()
     ↓
3. Extension sends SIGINT to process
     ↓
4. Process attempts graceful shutdown
     ↓
5. If process doesn't exit within 1 second:
   Extension sends SIGKILL
     ↓
6. Process terminates
     ↓
7. Extension sends TerminatedEvent to VSCode
     ↓
8. Debug session ends
```

## Error Handling

### Compilation Errors

```typescript
const binary = await compileActiveEditorsBinary(...);

if (!binary) {
  // Compilation failed
  this.sendEvent(new OutputEvent(
    'Compilation failed. Check output above.\n',
    'stderr'
  ));
  this.sendEvent(new TerminatedEvent());
  return;
}
```

### Runtime Errors

```typescript
this.process.on('error', (err: Error) => {
  this.sendEvent(new OutputEvent(
    `Failed to start process: ${err.message}\n`,
    'stderr'
  ));
  this.sendEvent(new TerminatedEvent());
});

this.process.on('close', (code: number) => {
  if (code !== 0) {
    this.sendEvent(new OutputEvent(
      `Process exited with error code ${code}\n`,
      'stderr'
    ));
  }
  this.sendEvent(new TerminatedEvent());
});
```

### Exception Handling

```typescript
try {
  // Launch sequence
} catch (error) {
  this.sendEvent(new OutputEvent(
    `Launch error: ${error.message}\n`,
    'stderr'
  ));
  this.sendEvent(new TerminatedEvent());
}
```

## Debug Protocol Events

### Events Sent by Extension

1. **OutputEvent** - Console output
   ```typescript
   new OutputEvent(message, 'stdout' | 'stderr')
   ```

2. **TerminatedEvent** - Session ended
   ```typescript
   new TerminatedEvent()
   ```

3. **InitializedEvent** - Session initialized
   ```typescript
   new InitializedEvent()
   ```

### Requests Handled by Extension

1. **InitializeRequest** - Declare capabilities
2. **ConfigurationDoneRequest** - Configuration complete
3. **LaunchRequest** - Start debugging
4. **DisconnectRequest** - Stop debugging
5. **TerminateRequest** - Force terminate

## Integration with fastedge-run CLI

The debug session is a thin wrapper around the `fastedge-run` CLI:

```
FastEdgeDebugSession
     ↓
  (Compiles binary)
     ↓
  (Spawns process)
     ↓
fastedge-run [args] binary.wasm
     ↓
  (HTTP server)
     ↓
http://localhost:8181
```

The CLI handles:
- WASM instantiation
- HTTP server setup
- Request routing
- Environment variable injection
- Header manipulation
- Logging

The debug session handles:
- Compilation orchestration
- Process management
- Output streaming to VSCode
- Lifecycle management

## Comparison with Proxy-Runner

| Aspect | FastEdge Extension | Proxy-Runner |
|--------|-------------------|--------------|
| **Execution** | fastedge-run CLI | Node.js WASM API |
| **UI** | VSCode Debug Console | Web-based Postman UI |
| **Output** | Streamed text logs | Structured hook results |
| **Debugging** | View logs only | Inspect inputs/outputs |
| **Compilation** | Automatic on F5 | Manual WASM upload |
| **Configuration** | launch.json + .env | UI inputs + properties |
| **Protocol** | Debug Adapter Protocol | HTTP REST API |

**Integration Goal:** Replace the debug session with proxy-runner's web UI while keeping the VSCode extension's compilation and configuration management.
