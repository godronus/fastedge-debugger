# Integration Plan: Proxy-Runner + FastEdge VSCode Extension

## Executive Summary

**Goal:** Integrate the proxy-runner with the FastEdge VSCode extension to create a unified testing tool that supports both **proxy-wasm** and **wasi-http** binaries through a Postman-like interface within VSCode.

**Strategy:**
1. Add wasi-http support to proxy-runner using FastEdge-lib
2. Replace the extension's debug session with proxy-runner's web UI
3. Keep compilation and configuration management in the extension
4. Provide unified interface for both binary types

## Current Architecture

### Proxy-Runner (This Repository)
```
├── Backend: Node.js + Express + TypeScript
│   ├── ProxyWasmRunner.ts - Executes proxy-wasm binaries
│   ├── HostFunctions.ts - Implements proxy-wasm ABI
│   └── WebSocket - Real-time updates
│
└── Frontend: React + Vite + TypeScript
    ├── Postman-like UI
    ├── Request/response testing
    └── Hook execution viewer
```

**Capabilities:**
- ✅ Proxy-wasm binary execution
- ✅ Hook-by-hook debugging
- ✅ Request/response inspection
- ✅ Property system debugging
- ❌ wasi-http support (to be added)

### FastEdge VSCode Extension
```
├── Compilation System
│   ├── Rust → cargo build
│   └── JavaScript → fastedge-build
│
├── Configuration System
│   ├── launch.json generation
│   └── DotEnv support
│
└── Debug Session
    ├── Spawns fastedge-run CLI
    ├── Streams logs to console
    └── Basic output viewing
```

**Capabilities:**
- ✅ Compiles Rust and JavaScript
- ✅ Integrated with VSCode debugger
- ✅ Configuration management
- ❌ Limited debugging UI
- ❌ No hook inspection

## Integration Architecture

### Phase 1: Add wasi-http Support to Proxy-Runner

**Implementation Tasks:**

1. **Add FastEdge-lib Integration**
   ```typescript
   // New module: server/runner/WasiHttpRunner.ts
   class WasiHttpRunner {
     // Similar to ProxyWasmRunner but for wasi-http
     async loadWasiHttp(buffer: Buffer): Promise<void>
     async executeWasiHttp(request: HttpRequest): Promise<HttpResponse>
   }
   ```

2. **Detect Binary Type**
   ```typescript
   // server/runner/BinaryDetector.ts
   enum BinaryType {
     ProxyWasm = 'proxy-wasm',
     WasiHttp = 'wasi-http'
   }

   function detectBinaryType(buffer: Buffer): BinaryType {
     // Inspect WASM imports to determine type
     // proxy-wasm: imports from "env" namespace
     // wasi-http: imports from "wasi:http" namespace
   }
   ```

3. **Unified Runner Interface**
   ```typescript
   // server/runner/UnifiedRunner.ts
   class UnifiedRunner {
     private proxyWasmRunner: ProxyWasmRunner;
     private wasiHttpRunner: WasiHttpRunner;
     private currentType: BinaryType;

     async load(buffer: Buffer): Promise<void> {
       this.currentType = detectBinaryType(buffer);
       if (this.currentType === BinaryType.ProxyWasm) {
         await this.proxyWasmRunner.load(buffer);
       } else {
         await this.wasiHttpRunner.load(buffer);
       }
     }

     async execute(request: HttpRequest): Promise<HttpResponse> {
       if (this.currentType === BinaryType.ProxyWasm) {
         return this.proxyWasmRunner.callFullFlow(request);
       } else {
         return this.wasiHttpRunner.executeWasiHttp(request);
       }
     }
   }
   ```

4. **Update API Endpoints**
   ```typescript
   // server/server.ts
   app.post('/api/load', async (req, res) => {
     const { wasmBase64, dotenvEnabled } = req.body;
     const buffer = Buffer.from(wasmBase64, 'base64');

     // Automatically detect and load correct runner
     await unifiedRunner.load(buffer, dotenvEnabled);

     const binaryType = unifiedRunner.getCurrentType();
     res.json({ ok: true, binaryType });
   });
   ```

### Phase 2: Embed Proxy-Runner in VSCode Extension

**Implementation Tasks:**

1. **Add Proxy-Runner as Dependency**
   ```bash
   # In fastedge-vscode/
   pnpm add proxy-runner
   # Or use local development version
   pnpm link /path/to/proxy-runner
   ```

2. **Start Proxy-Runner Server in Extension**
   ```typescript
   // fastedge-vscode/src/ProxyRunnerServer.ts
   import { startProxyRunner } from 'proxy-runner';

   export class ProxyRunnerServer {
     private serverProcess: ChildProcess | null = null;
     private port: number = 5179;

     async start(): Promise<void> {
       // Start proxy-runner server
       this.serverProcess = spawn('node', [
         'path/to/proxy-runner/dist/server.js'
       ], {
         env: {
           ...process.env,
           PORT: this.port.toString()
         }
       });

       // Wait for server to be ready
       await this.waitForServer();
     }

     async stop(): Promise<void> {
       if (this.serverProcess) {
         this.serverProcess.kill();
       }
     }

     getUrl(): string {
       return `http://localhost:${this.port}`;
     }
   }
   ```

3. **Replace Debug Session with Webview**
   ```typescript
   // fastedge-vscode/src/FastEdgeDebugSession.ts (modified)
   protected async launchRequest(
     response: DebugProtocol.LaunchResponse,
     args: LaunchConfiguration
   ): Promise<void> {
     // 1. Compile binary (keep existing logic)
     const binary = await compileActiveEditorsBinary(...);

     // 2. Start proxy-runner server
     await this.proxyRunnerServer.start();

     // 3. Upload binary to proxy-runner
     await fetch(`${this.proxyRunnerServer.getUrl()}/api/load`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         wasmBase64: binary.buffer.toString('base64'),
         dotenvEnabled: args.dotenv || false
       })
     });

     // 4. Open webview with proxy-runner UI
     const panel = vscode.window.createWebviewPanel(
       'fastedgeDebugger',
       'FastEdge Debugger',
       vscode.ViewColumn.One,
       {
         enableScripts: true,
         retainContextWhenHidden: true
       }
     );

     panel.webview.html = this.getWebviewHtml(
       this.proxyRunnerServer.getUrl()
     );

     this.sendResponse(response);
   }

   private getWebviewHtml(proxyRunnerUrl: string): string {
     return `
       <!DOCTYPE html>
       <html>
       <head>
         <meta charset="UTF-8">
         <style>
           body, html { margin: 0; padding: 0; height: 100%; }
           iframe { width: 100%; height: 100%; border: none; }
         </style>
       </head>
       <body>
         <iframe src="${proxyRunnerUrl}"></iframe>
       </body>
       </html>
     `;
   }
   ```

4. **Configuration Bridge**
   ```typescript
   // fastedge-vscode/src/ConfigurationBridge.ts
   export class ConfigurationBridge {
     // Convert launch.json to proxy-runner format
     static toProxyRunnerConfig(
       launchConfig: LaunchConfiguration
     ): ProxyRunnerConfig {
       return {
         properties: launchConfig.env,
         secrets: launchConfig.secrets,
         requestHeaders: launchConfig.headers,
         responseHeaders: launchConfig.responseHeaders,
         dotenvEnabled: !!launchConfig.dotenv
       };
     }

     // Apply configuration to proxy-runner
     static async applyConfig(
       proxyRunnerUrl: string,
       config: ProxyRunnerConfig
     ): Promise<void> {
       await fetch(`${proxyRunnerUrl}/api/config`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ config })
       });
     }
   }
   ```

### Phase 3: Enhanced Integration Features

**Implementation Tasks:**

1. **Bidirectional Communication**
   ```typescript
   // Extension ↔ Proxy-Runner WebSocket bridge
   class ExtensionBridge {
     // Forward VSCode events to proxy-runner
     onConfigChange(config: LaunchConfiguration) {
       this.ws.send(JSON.stringify({
         type: 'config_update',
         data: config
       }));
     }

     // Receive proxy-runner events
     onProxyRunnerEvent(event: any) {
       if (event.type === 'request_completed') {
         // Show notification in VSCode
         vscode.window.showInformationMessage(
           `Request completed: ${event.status}`
         );
       }
     }
   }
   ```

2. **Toolbar Integration**
   ```typescript
   // Add buttons to VSCode toolbar
   const sendRequestButton = vscode.window.createStatusBarItem(
     vscode.StatusBarAlignment.Left
   );
   sendRequestButton.text = "$(play) Send Request";
   sendRequestButton.command = 'fastedge.sendRequest';
   sendRequestButton.show();
   ```

3. **Test Scenario Management**
   ```typescript
   // Save/load test scenarios
   class ScenarioManager {
     async saveScenario(name: string) {
       const config = await this.getCurrentConfig();
       const scenarioPath = path.join(
         workspaceFolder,
         '.vscode',
         'scenarios',
         `${name}.json`
       );
       await fs.writeFile(
         scenarioPath,
         JSON.stringify(config, null, 2)
       );
     }

     async loadScenario(name: string) {
       const scenarioPath = path.join(
         workspaceFolder,
         '.vscode',
         'scenarios',
         `${name}.json`
       );
       const config = JSON.parse(
         await fs.readFile(scenarioPath, 'utf-8')
       );
       await this.applyConfig(config);
     }
   }
   ```

## File Structure After Integration

```
fastedge-vscode/
├── src/
│   ├── extension.ts (modified)
│   ├── FastEdgeDebugSession.ts (replaced with webview)
│   ├── ProxyRunnerServer.ts (new)
│   ├── ConfigurationBridge.ts (new)
│   ├── ExtensionBridge.ts (new)
│   └── compiler/ (keep existing)
│
└── proxy-runner/ (embedded)
    ├── Backend
    ├── Frontend
    └── Both binary types supported

proxy-runner/
├── server/
│   ├── runner/
│   │   ├── ProxyWasmRunner.ts (existing)
│   │   ├── WasiHttpRunner.ts (new)
│   │   ├── UnifiedRunner.ts (new)
│   │   └── BinaryDetector.ts (new)
│   └── server.ts (modified)
└── frontend/ (existing)
```

## Implementation Timeline

### Week 1-2: wasi-http Support
- [ ] Research FastEdge-lib API
- [ ] Implement WasiHttpRunner
- [ ] Add binary type detection
- [ ] Create UnifiedRunner
- [ ] Update API endpoints
- [ ] Test both binary types

### Week 3-4: Extension Integration
- [ ] Add proxy-runner as dependency
- [ ] Implement ProxyRunnerServer
- [ ] Replace debug session with webview
- [ ] Create ConfigurationBridge
- [ ] Test compilation → execution flow
- [ ] Handle edge cases

### Week 5-6: Enhanced Features
- [ ] Add bidirectional communication
- [ ] Implement toolbar buttons
- [ ] Add scenario management
- [ ] Polish UI integration
- [ ] Write documentation
- [ ] User testing

## Benefits of Integration

### For Users
1. **Unified Interface**: One tool for both binary types
2. **Better Debugging**: Postman-like UI vs console logs
3. **Visual Inspection**: See inputs/outputs of each hook
4. **Property Debugging**: Understand property flow
5. **Test Scenarios**: Save and replay requests

### For Developers
1. **Faster Testing**: Integrated compilation + execution
2. **Configuration Management**: launch.json + dotenv
3. **VSCode Integration**: Familiar debugger interface
4. **Real-time Feedback**: WebSocket updates
5. **Multiple Languages**: Rust and JavaScript support

## Risks and Mitigations

### Risk 1: wasi-http Complexity
**Mitigation:** Start with FastEdge-lib examples, iterate on implementation

### Risk 2: VSCode Webview Limitations
**Mitigation:** Use iframe for full proxy-runner UI, minimal restrictions

### Risk 3: Configuration Synchronization
**Mitigation:** Clear precedence rules, validate both sides

### Risk 4: Performance
**Mitigation:** Run proxy-runner in separate process, optimize WebSocket

## Success Criteria

- [ ] Both proxy-wasm and wasi-http binaries execute correctly
- [ ] Compilation works for Rust and JavaScript
- [ ] Webview displays full proxy-runner UI
- [ ] Configuration flows from launch.json to proxy-runner
- [ ] Real-time updates work via WebSocket
- [ ] Test scenarios can be saved and loaded
- [ ] Extension passes VSCode marketplace requirements
- [ ] Documentation is complete and accurate

## Next Steps

1. **Prototype wasi-http support** in proxy-runner
2. **Test with sample binaries** (both types)
3. **Create minimal extension integration** with webview
4. **Iterate on user experience** based on feedback
5. **Prepare for release** with documentation and examples
