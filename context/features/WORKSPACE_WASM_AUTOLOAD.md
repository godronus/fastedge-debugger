# Workspace WASM Auto-Loading (VSCode Integration)

**Status:** ✅ Implemented
**Date:** February 12, 2026
**Feature:** Automatic loading of workspace WASM file in VSCode environment

---

## Overview

When the fastedge-debugger runs within VSCode, it automatically detects and loads the workspace's compiled WASM binary at `.fastedge/bin/debugger.wasm`. This provides a seamless development workflow where the debugger always loads the most recent build.

## Key Features

1. **Auto-Detection on Startup**: When running in VSCode, the debugger automatically checks for and loads the workspace WASM file
2. **Tab-Based UI**: File Path and Upload File options presented as tabs with environment-aware defaults
3. **F5 Rebuild Integration**: After pressing F5 to rebuild, the debugger automatically reloads the updated WASM
4. **Compact Info Display**: Load metrics shown in the tab bar to save vertical space

---

## Architecture

### Environment Detection

The system uses environment variables to detect the runtime context:

```typescript
// VSCode Extension (DebuggerServerManager.ts)
env: {
  VSCODE_INTEGRATION: "true",     // Signals VSCode environment
  WORKSPACE_PATH: workspacePath,   // Path to workspace root
}
```

### Server Endpoints

**GET `/api/environment`**
- Returns: `{ environment: 'vscode' | 'node', supportsPathLoading: boolean }`
- Used by frontend to adapt UI

**GET `/api/workspace-wasm`**
- Returns: `{ path: string | null }`
- Checks for `.fastedge/bin/debugger.wasm` in workspace
- Only available in VSCode environment

**POST `/api/reload-workspace-wasm`**
- Triggers WebSocket event to reload workspace WASM
- Called by VSCode extension after F5 rebuild
- Returns: `{ ok: true, path: string }`

### WebSocket Events

**`reload_workspace_wasm` Event**
```typescript
interface ReloadWorkspaceWasmEvent {
  type: "reload_workspace_wasm";
  data: {
    path: string;  // Path to workspace WASM file
  };
  source: EventSource;
  timestamp: number;
}
```

---

## Frontend Flow

### On Startup (VSCode Environment)

```
1. App mounts
   ↓
2. Call GET /api/environment
   ↓
3. Detect environment = 'vscode'
   ↓
4. Call GET /api/workspace-wasm
   ↓
5. If path exists:
   - Auto-load WASM file
   - Set File Path tab as default
   ↓
6. Display load info in tab bar:
   "📁 Path-based • 42.5ms • (11.0 MB)"
```

### After F5 Rebuild

```
1. VSCode extension detects build completion
   ↓
2. Call debuggerServerManager.reloadWorkspaceWasm()
   ↓
3. Server: POST /api/reload-workspace-wasm
   ↓
4. Server emits WebSocket event: reload_workspace_wasm
   ↓
5. Frontend receives event
   ↓
6. Frontend reloads WASM from path
   ↓
7. Tab switches to File Path (if not already)
```

---

## UI Implementation

### Tab-Based Loader

The WasmLoader component presents two tabs:

- **📁 File Path**: Path-based loading (fast, 70-95% faster than buffer)
- **📤 Upload File**: Buffer-based loading (universal fallback)

**Default Tab Logic:**
- VSCode environment → File Path tab active
- Node environment → Upload File tab active
- User can switch tabs at any time

### Compact Load Info

Instead of a separate panel, load metrics are displayed in the tab bar:

```
[📁 File Path] [📤 Upload File]     💾 Buffer-based • 388.0ms • (11.0 MB)
```

**Benefits:**
- Saves vertical space
- Always visible regardless of active tab
- Shows: mode icon, loading type, time, file size

---

## VSCode Extension Integration

### Setup in extension.ts

```typescript
import * as vscode from "vscode";
import { DebuggerServerManager } from "./debugger";

// Get workspace path
const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

// Initialize with workspace path
const debuggerServerManager = new DebuggerServerManager(
  context.extensionPath,
  workspacePath
);
```

### Triggering Reload After Build

Add to your F5 build completion handler:

```typescript
// After build completes successfully
if (debuggerServerManager && debuggerServerManager.isRunning()) {
  await debuggerServerManager.reloadWorkspaceWasm();
}
```

**Example Integration:**
```typescript
vscode.debug.onDidTerminateDebugSession(async (session) => {
  // Build completed
  if (session.configuration.type === 'fastedge') {
    console.log('Build completed, reloading workspace WASM...');
    await debuggerServerManager.reloadWorkspaceWasm();
  }
});
```

---

## File Locations

### Workspace WASM Path

The expected location for the compiled WASM binary:
```
<workspace>/.fastedge/bin/debugger.wasm
```

This is the standard output location when pressing F5 to build in VSCode.

### Key Files Modified

**VSCode Extension:**
- `FastEdge-vscode/src/debugger/DebuggerServerManager.ts` - Added workspace path and reload method
- `FastEdge-vscode/src/extension.ts` - Pass workspace path on initialization

**Server:**
- `server/server.ts` - Added `/api/workspace-wasm` and `/api/reload-workspace-wasm` endpoints
- `server/websocket/types.ts` - Added `ReloadWorkspaceWasmEvent` type
- `server/websocket/StateManager.ts` - Added `emitReloadWorkspaceWasm()` method

**Frontend:**
- `frontend/src/api/index.ts` - Added `getEnvironment()` and `getWorkspaceWasm()` functions
- `frontend/src/App.tsx` - Auto-load logic and WebSocket event handler
- `frontend/src/components/common/WasmLoader/WasmLoader.tsx` - Tab-based UI
- `frontend/src/hooks/websocket-types.ts` - Added `ReloadWorkspaceWasmEvent` type

---

## Benefits

1. **Zero-Click Workflow**: No manual file selection needed
2. **Fast Iteration**: F5 → Auto-reload → Test immediately
3. **Production Parity**: Uses path-based loading (70-95% faster)
4. **Clean UI**: Compact tab interface saves screen space
5. **Universal Fallback**: Upload tab always available if needed

---

## Testing

### Manual Testing

**Test Auto-Load on Startup:**
1. Build WASM: F5 in VSCode
2. Open debugger
3. Verify WASM auto-loads from `.fastedge/bin/debugger.wasm`
4. Verify File Path tab is active

**Test F5 Reload:**
1. Load WASM in debugger
2. Modify code and press F5
3. Verify debugger automatically reloads updated WASM
4. Verify File Path tab becomes active

**Test Tab Switching:**
1. Switch between File Path and Upload tabs
2. Verify content panels change
3. Verify load info remains visible in tab bar

### Environment Testing

**VSCode Environment:**
- Should show File Path tab as default
- Should auto-load workspace WASM
- Should receive reload events

**Node Environment:**
- Should show Upload File tab as default
- Should not attempt workspace WASM detection
- Should function normally with manual uploads

---

## Known Issues & Limitations

1. **Single Workspace Only**: Only supports the first workspace folder
2. **Fixed Path**: Expects WASM at `.fastedge/bin/debugger.wasm` (not configurable)
3. **No Visual Feedback**: Reload happens silently (no toast notification)

---

## Future Enhancements

- [ ] Configurable workspace WASM path
- [ ] Toast notification on auto-reload
- [ ] Build status integration (show "Building..." indicator)
- [ ] Multi-workspace support
- [ ] File watcher for automatic reload without F5 trigger

---

## See Also

- [VSCODE_BUNDLING.md](../VSCODE_BUNDLING.md) - VSCode extension bundling
- [WEBSOCKET_IMPLEMENTATION.md](./WEBSOCKET_IMPLEMENTATION.md) - WebSocket architecture
- [HTTP_WASM_UI.md](./HTTP_WASM_UI.md) - UI components and patterns
