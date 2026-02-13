# Config Editor Feature

## Overview

Modal-based configuration editor that allows users to save and load test configurations to/from JSON files. Supports multiple save strategies depending on the browser environment.

---

## Components

### ConfigEditorModal
**Location:** `frontend/src/components/ConfigEditorModal/`

Modal with two tabs:
- **JSON Editor** (Implemented) - Real-time JSON editing with validation
- **Form Editor** (Coming Soon) - Visual form with existing UI components

**Key Features:**
- Real-time JSON validation with error highlighting
- Format button for pretty-printing
- Smart save strategy (tries multiple methods)
- ESC key to close
- Backdrop click to close

---

## Save Flow (3-Tier Strategy)

### 1. File System Access API (Chrome/Edge)
**When:** Modern browsers (Chrome 86+, Edge 86+)
**Result:** Native OS "Save As" dialog with full folder navigation

```typescript
await window.showSaveFilePicker({
  suggestedName: 'my-config.json',
  types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
});
```

**Pros:**
- ✅ Native OS dialog (familiar UX)
- ✅ Browse folders freely
- ✅ Create directories
- ✅ Overwrite confirmation

**Cons:**
- ❌ Only Chrome/Edge/Opera support
- ❌ Not available in Firefox/Safari
- ❌ Not available in VS Code webviews

---

### 2. Backend Electron Dialog (VS Code Integration)
**When:** Running in VS Code webview (future)
**Endpoint:** `POST /api/config/show-save-dialog`

Backend attempts to use Electron's dialog API (if available):
```typescript
electron.dialog.showSaveDialog({ ... })
```

**For VS Code Extension Integration:**

The extension should intercept and handle the dialog:

```typescript
// Extension code
webview.onMessage(async (message) => {
  if (message.type === 'showSaveDialog') {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(message.suggestedName),
      filters: { 'JSON': ['json'] }
    });

    if (uri) {
      // Return path to webview
      webview.postMessage({
        type: 'saveDialogResult',
        filePath: uri.fsPath
      });
    }
  }
});
```

Then frontend saves via `POST /api/config/save-as` with the path.

---

### 3. Prompt Fallback (Firefox/Safari)
**When:** File System Access API not available
**Result:** Text prompt asking for file path

User enters path (relative or absolute):
- `configs/my-test.json` → Saves to project root + path
- `/absolute/path/config.json` → Saves to absolute path
- `my-config.json` → Saves to project root

Backend ensures `.json` extension and creates directories if needed.

**Pros:**
- ✅ Works in all browsers
- ✅ Can save anywhere with path

**Cons:**
- ❌ Not user-friendly (must type path)
- ❌ No folder browsing
- ❌ Easy to make path mistakes

---

## Load Flow

Uses native `<input type="file">` picker - works in all browsers.

```typescript
const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';
input.onchange = (e) => {
  const file = e.target.files[0];
  const config = JSON.parse(await file.text());
  loadFromConfig(config);
};
input.click();
```

---

## Browser Compatibility

| Browser | Save Method | Dialog Type |
|---------|-------------|-------------|
| **Chrome 86+** | File System Access API | ✅ Native OS dialog |
| **Edge 86+** | File System Access API | ✅ Native OS dialog |
| **Opera 72+** | File System Access API | ✅ Native OS dialog |
| **Firefox** | Prompt fallback | ❌ Text prompt only |
| **Safari** | Prompt fallback | ❌ Text prompt only |
| **VS Code webview** | Backend dialog (future) | ✅ VS Code dialog (when integrated) |

---

## API Endpoints

### `POST /api/config/show-save-dialog`
Shows save dialog (Electron only, for VS Code integration).

**Request:**
```json
{
  "suggestedName": "my-config.json"
}
```

**Response (success):**
```json
{
  "ok": true,
  "filePath": "/home/user/my-config.json"
}
```

**Response (cancelled):**
```json
{
  "ok": true,
  "canceled": true
}
```

**Response (not available):**
```json
{
  "ok": false,
  "fallbackRequired": true,
  "error": "Dialog API not available"
}
```

---

### `POST /api/config/save-as`
Saves config to specified file path.

**Request:**
```json
{
  "config": { ... },
  "filePath": "configs/my-test.json"
}
```

**Response:**
```json
{
  "ok": true,
  "savedPath": "/full/path/to/configs/my-test.json"
}
```

**Features:**
- Creates directories if needed
- Ensures `.json` extension
- Supports relative and absolute paths
- Relative paths resolve from project root

---

## File Naming

Suggested filename uses WASM name if available:
```typescript
const wasmName = config.wasm?.path
  .split("/").pop()
  ?.replace(".wasm", "");

const suggestedName = wasmName
  ? `${wasmName}-config.json`
  : "test-config.json";
```

**Examples:**
- WASM: `my-filter.wasm` → Suggests: `my-filter-config.json`
- No WASM → Suggests: `test-config.json`

---

## JSON Validation

Real-time validation checks:
- ✅ Valid JSON syntax
- ✅ Required fields: `request`, `properties`, `logLevel`
- ✅ Required nested fields: `request.method`, `request.url`, `request.headers`, `request.body`
- ✅ Type checking: `logLevel` must be number
- ✅ Optional fields: `description`, `wasm` (with required `wasm.path`)

**Validation Errors:**
- Show inline with error message
- Prevent saving while invalid
- Update in real-time as user types

---

## Known Limitations

### 1. No Native Dialog in Firefox/Safari
**Issue:** File System Access API not supported
**Impact:** Users must type file path in prompt
**Workaround:** Use Chrome/Edge for testing, or accept prompt UX
**Future:** Could build custom file browser UI

### 2. VS Code Webview Integration Required
**Issue:** Backend Electron dialog doesn't work in standard Node.js server
**Impact:** Falls back to prompt when embedded in VS Code (until extension integration)
**Solution:** VS Code extension must intercept dialog calls and use `vscode.window.showSaveDialog()`

### 3. Form Editor Tab Not Implemented
**Issue:** Only JSON editor tab is functional
**Impact:** Users must edit raw JSON (no visual form)
**Future:** Will reuse existing components (PropertiesEditor, RequestPanel, etc.)

---

## Testing Recommendations

### Local Development (Node + Browser)
- ✅ **Chrome/Edge**: Full native dialog experience
- ⚠️ **Firefox**: Prompt fallback only

### VS Code Extension Development
- Requires extension integration (see "Backend Electron Dialog" section above)
- Extension must handle `showSaveDialog` messages
- Returns path to webview for saving

---

## Future Enhancements

### Form Editor Tab
Reuse existing components in controlled mode:
```tsx
<FormEditorTab config={config} onChange={setConfig}>
  <PropertiesEditorControlled
    value={config.properties}
    onChange={(p) => setConfig({...config, properties: p})}
  />
  <RequestPanelControlled ... />
  <LogLevelSelectorControlled ... />
</FormEditorTab>
```

**Benefits:**
- Familiar UI (same as main app)
- Visual editing (no JSON knowledge needed)
- Sync with JSON tab

**Requirements:**
- Extract logic into hooks (`usePropertiesLogic`, etc.)
- Create controlled versions of components
- Implement bi-directional sync between tabs

---

### Custom File Browser (Universal Solution)
Build HTML/CSS/JS file tree component:
- Backend API: `GET /api/filesystem/list?path=...`
- Frontend: Tree navigation + filename input
- Works in all browsers
- Consistent UX

**Pros:** Universal, no browser dependencies
**Cons:** 1-2 hours work, security considerations for directory listing

---

## Debug Logging

Console logs help diagnose save issues:

```
[ConfigEditor] File System Access API available: true/false
[ConfigEditor] Browser: Mozilla/5.0 ...
[ConfigEditor] Attempting to show save dialog...
[ConfigEditor] Dialog closed, handle: ...
```

**Can be removed for production** or gated behind debug flag.

---

## Files Modified

**Created:**
- `frontend/src/components/ConfigEditorModal/ConfigEditorModal.tsx`
- `frontend/src/components/ConfigEditorModal/ConfigEditorModal.module.css`
- `frontend/src/components/ConfigEditorModal/JsonEditorTab.tsx`
- `frontend/src/components/ConfigEditorModal/JsonEditorTab.module.css`
- `frontend/src/components/ConfigEditorModal/index.tsx`

**Modified:**
- `frontend/src/App.tsx` - Modal integration, load/save handlers
- `frontend/src/api/index.ts` - Added `showSaveDialog()`, `saveConfigAs()`
- `server/server.ts` - Added dialog and save-as endpoints

---

## Integration with Existing Features

### Config State Management
Uses existing Zustand store methods:
- `exportConfig()` - Gets current state as TestConfig
- `loadFromConfig(config)` - Loads config into store

### WebSocket Integration
When config saved via backend, properties update events are emitted:
```typescript
if (config.properties) {
  stateManager.emitPropertiesUpdated(config.properties, source);
}
```

### Environment Detection
Respects existing environment logic:
- `getEnvironment()` API returns `'vscode' | 'node'`
- Determines default behavior and available features

---

**Last Updated:** February 2026
