# FastEdge VSCode Extension - Compilation System

## Overview

The extension supports two languages and their respective build systems:
- **Rust** → cargo + wasm32-wasip1 target
- **JavaScript/TypeScript** → fastedge-build (npm package)

## Compiler Module Structure

```
src/compiler/
├── index.ts          # Main compilation orchestrator
├── rustBuild.ts      # Rust → WASM compilation
├── rustConfig.ts     # Rust target configuration
└── jsBuild.ts        # JavaScript → WASM compilation
```

## Rust Compilation

### Source File: `src/compiler/rustBuild.ts`

### Prerequisites

```bash
# Add WASM target
rustup target add wasm32-wasip1
```

### Compilation Process

```typescript
export async function buildRustProject(
  activeFilePath: string,
  logToDebugConsole: LogToDebugConsole
): Promise<string | undefined> {
  // 1. Get target from rustConfig
  const target = rustConfigWasiTarget();
  logToDebugConsole(`WASM build target: ${target}`);

  // 2. Build cargo command
  const args = [
    'build',
    '--message-format=json',  // Structured output
    `--target=${target}`       // wasm32-wasip1
  ];

  // 3. Spawn cargo process
  const cargoProcess = spawn('cargo', args, {
    cwd: activeFilePath  // Project directory
  });

  // 4. Collect stdout (JSON messages)
  let stdoutData = '';
  cargoProcess.stdout.on('data', (data: Buffer) => {
    stdoutData += data.toString();
  });

  // 5. Stream stderr (build progress) to console
  cargoProcess.stderr.on('data', (data: Buffer) => {
    logToDebugConsole(data.toString(), 'stderr');
  });

  // 6. Parse cargo output on completion
  return new Promise((resolve, reject) => {
    cargoProcess.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`Cargo build failed with code ${code}`));
        return;
      }

      // Parse each JSON line
      const lines = stdoutData.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const message = JSON.parse(line);

          // Find compiler artifact with WASM output
          if (message.reason === 'compiler-artifact' &&
              message.filenames?.length === 1 &&
              message.filenames[0].endsWith('.wasm')) {
            resolve(message.filenames[0]);
            return;
          }
        } catch (err) {
          // Skip invalid JSON lines
        }
      }

      reject(new Error('WASM binary not found in cargo output'));
    });
  });
}
```

### Cargo Output Format

**Example JSON message:**
```json
{
  "reason": "compiler-artifact",
  "package_id": "my-fastedge-app 0.1.0 (path+file:///path/to/project)",
  "manifest_path": "/path/to/project/Cargo.toml",
  "target": {
    "kind": ["bin"],
    "crate_types": ["bin"],
    "name": "my-fastedge-app",
    "src_path": "/path/to/project/src/main.rs"
  },
  "profile": {
    "opt_level": "0",
    "debuginfo": 2,
    "test": false
  },
  "features": [],
  "filenames": [
    "/path/to/project/target/wasm32-wasip1/debug/my-fastedge-app.wasm"
  ],
  "executable": null,
  "fresh": false
}
```

### WASM Target Configuration

**Source File: `src/compiler/rustConfig.ts`**

```typescript
export function rustConfigWasiTarget(): string {
  // Returns the appropriate WASM target
  return 'wasm32-wasip1';  // WASI Preview 1
}
```

### Example Rust Project Structure

```
my-rust-app/
├── Cargo.toml
├── Cargo.lock
├── src/
│   └── main.rs
└── target/
    └── wasm32-wasip1/
        └── debug/
            └── my-rust-app.wasm  ← Output
```

### Example Cargo.toml

```toml
[package]
name = "my-fastedge-app"
version = "0.1.0"
edition = "2021"

[dependencies]
fastedge-sdk-rust = "0.1.0"

[lib]
crate-type = ["cdylib"]
```

## JavaScript Compilation

### Source File: `src/compiler/jsBuild.ts`

### Prerequisites

```bash
npm install --save-dev @gcoredev/fastedge-sdk-js
```

### Compilation Process

```typescript
export async function buildJavaScriptProject(
  context: DebugContext,  // 'file' or 'workspace'
  activeFilePath: string,
  workspaceFolder: vscode.WorkspaceFolder,
  logToDebugConsole: LogToDebugConsole
): Promise<string | undefined> {
  // 1. Determine entry point
  let entryPoint: string;

  if (context === 'file') {
    // Use active file directly
    entryPoint = activeFilePath;
  } else {
    // Read package.json to find main entry
    const packageJsonPath = path.join(
      workspaceFolder.uri.fsPath,
      'package.json'
    );
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf-8')
    );
    entryPoint = path.join(
      workspaceFolder.uri.fsPath,
      packageJson.main || 'index.js'
    );
  }

  // 2. Create output directory
  const outputDir = path.join(
    workspaceFolder.uri.fsPath,
    '.vscode',
    'bin'
  );
  fs.mkdirSync(outputDir, { recursive: true });

  // 3. Define output path
  const outputPath = path.join(outputDir, 'debugger.wasm');

  // 4. Build fastedge-build command
  const args = [
    'fastedge-build',
    entryPoint,
    outputPath
  ];

  // 5. Spawn npx process
  const buildProcess = spawn('npx', args, {
    cwd: workspaceFolder.uri.fsPath
  });

  // 6. Stream stdout to console
  buildProcess.stdout.on('data', (data: Buffer) => {
    logToDebugConsole(data.toString(), 'stdout');
  });

  // 7. Collect stderr
  let stderrData = '';
  buildProcess.stderr.on('data', (data: Buffer) => {
    stderrData += data.toString();
  });

  // 8. Handle completion
  return new Promise((resolve, reject) => {
    buildProcess.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(
          `fastedge-build failed with code ${code}\n${stderrData}`
        ));
        return;
      }

      resolve(outputPath);
    });
  });
}
```

### Example JavaScript Project Structure

```
my-js-app/
├── package.json
├── package-lock.json
├── src/
│   └── index.js
└── .vscode/
    └── bin/
        └── debugger.wasm  ← Output
```

### Example package.json

```json
{
  "name": "my-fastedge-app",
  "version": "1.0.0",
  "main": "src/index.js",
  "devDependencies": {
    "@gcoredev/fastedge-sdk-js": "^0.1.0"
  }
}
```

### Example JavaScript Entry Point

```javascript
// src/index.js
import { addEventListener } from '@gcoredev/fastedge-sdk-js';

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  return new Response('Hello from FastEdge!', {
    status: 200,
    headers: {
      'content-type': 'text/plain'
    }
  });
}
```

## Compilation Orchestrator

### Source File: `src/compiler/index.ts`

```typescript
export async function compileActiveEditorsBinary(
  context: DebugContext,
  logToDebugConsole: LogToDebugConsole
): Promise<BinaryInfo | undefined> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    throw new Error('No active editor');
  }

  const activeFilePath = activeEditor.document.uri.fsPath;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(
    activeEditor.document.uri
  );

  // Detect language from file extension or project structure
  const language = detectLanguage(activeFilePath);

  let binaryPath: string | undefined;

  if (language === 'rust') {
    // Rust compilation
    logToDebugConsole('Compiling Rust project...\n');
    binaryPath = await buildRustProject(
      path.dirname(activeFilePath),
      logToDebugConsole
    );
  } else if (language === 'javascript') {
    // JavaScript compilation
    logToDebugConsole('Building JavaScript project...\n');
    binaryPath = await buildJavaScriptProject(
      context,
      activeFilePath,
      workspaceFolder!,
      logToDebugConsole
    );
  } else {
    throw new Error(`Unsupported language: ${language}`);
  }

  if (!binaryPath) {
    return undefined;
  }

  return {
    path: binaryPath,
    lang: language
  };
}

function detectLanguage(filePath: string): ExtLanguage {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.rs') {
    return 'rust';
  } else if (ext === '.js' || ext === '.ts') {
    return 'javascript';
  }

  // Check for Cargo.toml (Rust) or package.json (JavaScript)
  const dir = path.dirname(filePath);
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
    return 'rust';
  } else if (fs.existsSync(path.join(dir, 'package.json'))) {
    return 'javascript';
  }

  throw new Error('Could not detect project language');
}
```

## Compilation Output

### Rust Output

```
Compiling my-fastedge-app v0.1.0 (/path/to/project)
    Finished dev [unoptimized + debuginfo] target(s) in 2.34s
Binary compiled: /path/to/project/target/wasm32-wasip1/debug/my-fastedge-app.wasm
```

### JavaScript Output

```
Building JavaScript project...
✓ Bundled entry point: src/index.js
✓ Compiled to WASM: .vscode/bin/debugger.wasm
Build complete in 1.23s
Binary compiled: /path/to/project/.vscode/bin/debugger.wasm
```

## Error Handling

### Rust Errors

```typescript
try {
  const binary = await buildRustProject(...);
} catch (error) {
  logToDebugConsole(
    `Rust compilation failed: ${error.message}\n`,
    'stderr'
  );
  return undefined;
}
```

**Common errors:**
- `wasm32-wasip1` target not installed
- Cargo.toml not found
- Compilation errors in Rust code
- Missing dependencies

### JavaScript Errors

```typescript
try {
  const binary = await buildJavaScriptProject(...);
} catch (error) {
  logToDebugConsole(
    `JavaScript build failed: ${error.message}\n`,
    'stderr'
  );
  return undefined;
}
```

**Common errors:**
- `@gcoredev/fastedge-sdk-js` not installed
- Entry point not found
- Syntax errors in JavaScript code
- Build tool errors

## Build Performance

### Rust
- **Initial build**: 10-30 seconds (depending on dependencies)
- **Incremental build**: 1-5 seconds
- **Output size**: 500KB - 2MB (debug), 100KB - 500KB (release)

### JavaScript
- **Build time**: 1-5 seconds
- **Output size**: 200KB - 1MB
- **Bundling**: Includes all npm dependencies

## Integration with Proxy-Runner

### Current State
- Extension compiles → fastedge-run executes
- Proxy-runner receives pre-compiled WASM

### Future State
- Extension compiles → proxy-runner executes
- Support both proxy-wasm and wasi-http binaries
- Unified compilation + execution flow

### Implementation Considerations

1. **Keep compilation in extension** - It's well-integrated with VSCode
2. **Replace execution** - Use proxy-runner instead of fastedge-run
3. **Add wasi-http support** - Proxy-runner needs FastEdge-lib integration
4. **Maintain language detection** - Both Rust and JS support
