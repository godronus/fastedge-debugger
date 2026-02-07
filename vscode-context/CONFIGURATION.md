# FastEdge VSCode Extension - Configuration System

## launch.json Structure

### Complete Example

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "fastedge",
      "name": "FastEdge App",
      "request": "launch",
      "port": 8181,
      "dotenv": true,
      "env": {
        "LOG_LEVEL": "debug",
        "API_URL": "https://api.example.com"
      },
      "secrets": {
        "API_KEY": "secret-value-here",
        "JWT_SECRET": "another-secret"
      },
      "headers": {
        "authorization": "Bearer token",
        "x-custom-header": "value"
      },
      "responseHeaders": {
        "x-custom-response": "response-value"
      },
      "geoIpHeaders": true,
      "memoryLimit": 67108864,
      "traceLogging": true
    }
  ]
}
```

### Configuration Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `type` | string | ✅ | - | Must be `"fastedge"` |
| `name` | string | ✅ | - | Display name in debug dropdown |
| `request` | string | ✅ | - | Must be `"launch"` |
| `cliPath` | string | ❌ | Auto-detected | Path to fastedge-run binary |
| `entrypoint` | string | ❌ | Prompted | `"file"` or `"workspace"` |
| `binary` | string | ❌ | Auto-compiled | Pre-compiled WASM path |
| `port` | number | ❌ | `8181` | HTTP server port |
| `dotenv` | boolean/string | ❌ | `false` | Load .env files (true/false/path) |
| `env` | object | ❌ | `{}` | Environment variables |
| `secrets` | object | ❌ | `{}` | Sensitive configuration |
| `headers` | object | ❌ | `{}` | Request headers |
| `responseHeaders` | object | ❌ | `{}` | Response headers |
| `geoIpHeaders` | boolean | ❌ | `false` | Inject geo-location headers |
| `memoryLimit` | number | ❌ | - | WASM memory limit (bytes) |
| `traceLogging` | boolean | ❌ | `false` | Verbose debug output |

## DotEnv System

### Enabling DotEnv

**Option 1: Boolean (auto-discovery)**
```json
{
  "dotenv": true
}
```
Searches for `.env` file starting from debug location, moving up to workspace root.

**Option 2: Custom Path**
```json
{
  "dotenv": "./config/.env"
}
```
Loads specific file. Path is **workspace-relative**, not relative to debug location.

### Variable Prefixes

The extension uses prefixes to categorize environment variables:

| Prefix | Category | Example |
|--------|----------|---------|
| `FASTEDGE_VAR_ENV_` | Environment Variables | `FASTEDGE_VAR_ENV_LOG_LEVEL=debug` |
| `FASTEDGE_VAR_SECRET_` | Secrets | `FASTEDGE_VAR_SECRET_API_KEY=secret123` |
| `FASTEDGE_VAR_REQ_HEADER_` | Request Headers | `FASTEDGE_VAR_REQ_HEADER_AUTHORIZATION=Bearer token` |
| `FASTEDGE_VAR_RSP_HEADER_` | Response Headers | `FASTEDGE_VAR_RSP_HEADER_X_CUSTOM=value` |

### Example .env File

```bash
# .env

# Environment variables
FASTEDGE_VAR_ENV_LOG_LEVEL=debug
FASTEDGE_VAR_ENV_API_URL=https://api.example.com
FASTEDGE_VAR_ENV_NODE_ENV=development

# Secrets
FASTEDGE_VAR_SECRET_API_KEY=sk_test_123456789
FASTEDGE_VAR_SECRET_JWT_SECRET=super-secret-jwt-key
FASTEDGE_VAR_SECRET_DB_PASSWORD=postgres123

# Request headers
FASTEDGE_VAR_REQ_HEADER_AUTHORIZATION=Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
FASTEDGE_VAR_REQ_HEADER_X_API_KEY=api-key-value
FASTEDGE_VAR_REQ_HEADER_USER_AGENT=FastEdge-Test/1.0

# Response headers
FASTEDGE_VAR_RSP_HEADER_X_POWERED_BY=FastEdge
FASTEDGE_VAR_RSP_HEADER_X_CUSTOM_HEADER=custom-value
```

### Specialized DotEnv Files

In addition to `.env`, you can use specialized files:

1. **`.env.variables`** - Environment variables only
   ```bash
   # No prefix needed
   LOG_LEVEL=debug
   API_URL=https://api.example.com
   ```

2. **`.env.secrets`** - Secrets only
   ```bash
   # No prefix needed
   API_KEY=secret-value
   JWT_SECRET=another-secret
   ```

3. **`.env.req_headers`** - Request headers only
   ```bash
   # No prefix needed
   authorization=Bearer token
   x-custom-header=value
   ```

4. **`.env.rsp_headers`** - Response headers only
   ```bash
   # No prefix needed
   x-custom-response=value
   x-powered-by=FastEdge
   ```

### Configuration Hierarchy

Settings are merged with the following priority (highest to lowest):

```
1. launch.json (highest priority)
     ↓
2. .env (main file with prefixes)
     ↓
3. Specialized files (.env.variables, .env.secrets, etc.)
     ↓
4. Defaults (lowest priority)
```

**Example:**
```json
// launch.json
{
  "env": {
    "LOG_LEVEL": "info"  // ← Overrides .env
  }
}
```

```bash
# .env
FASTEDGE_VAR_ENV_LOG_LEVEL=debug  # ← Ignored, launch.json wins
FASTEDGE_VAR_ENV_API_URL=https://api.example.com  # ← Used
```

**Result:**
```javascript
{
  LOG_LEVEL: "info",        // From launch.json
  API_URL: "https://api.example.com"  // From .env
}
```

## Security Best Practices

### .gitignore Recommendations

```bash
# .gitignore

# Sensitive configuration
.env
.env.local
.env.*.local
.env.secrets
*.secret
*.key

# VSCode settings (optional - depends on team preference)
.vscode/launch.json  # If it contains secrets
.vscode/mcp.json     # Contains API keys
```

### MCP Configuration Security

When generating `mcp.json`, the extension:
1. ✅ Stores credentials in VSCode's **secure storage**
2. ✅ Warns users to add `mcp.json` to `.gitignore`
3. ✅ For Codespaces: Recommends using environment variables

**Example secure setup:**
```bash
# In Codespace: Use secrets instead of mcp.json
gh secret set FASTEDGE_API_KEY --body "your-api-key"
```

### Launch.json Security

**❌ Don't:**
```json
{
  "secrets": {
    "API_KEY": "sk_live_12345678"  // ← Hard-coded secret in repo
  }
}
```

**✅ Do:**
```json
{
  "dotenv": true,  // ← Load from .env (not in repo)
  "secrets": {}    // ← Empty, uses dotenv
}
```

## CLI Arguments Generation

The extension converts configuration to CLI arguments:

### From Configuration
```json
{
  "port": 3000,
  "env": {"LOG_LEVEL": "debug"},
  "secrets": {"API_KEY": "secret"},
  "headers": {"authorization": "Bearer token"},
  "geoIpHeaders": true,
  "memoryLimit": 67108864,
  "traceLogging": true
}
```

### To CLI Arguments
```bash
fastedge-run \
  --port 3000 \
  --env LOG_LEVEL=debug \
  --secret API_KEY=secret \
  --header authorization="Bearer token" \
  --geo-ip-headers \
  --memory-limit 67108864 \
  --trace \
  path/to/binary.wasm
```

## Configuration Validation

The `BinaryDebugConfigurationProvider` validates configuration before launch:

### Required Fields
- ✅ `type` must be `"fastedge"`
- ✅ `request` must be `"launch"`
- ✅ `cliPath` auto-detected or user-provided

### Optional Field Defaults
- Port → `8181`
- Entrypoint → Prompts user if ambiguous
- Binary → Compiled automatically if not provided

### Validation Errors

**Missing CLI binary:**
```
Error: No program specified for debugging
```
→ CLI binary not found for current platform

**Ambiguous entrypoint:**
```
Quick Pick: "Debug current file" or "Debug workspace"?
```
→ User must select debug context

**Invalid configuration:**
```
Error: Invalid launch configuration
```
→ Configuration doesn't match LaunchConfiguration interface

## Workspace-Relative Paths

All paths in `launch.json` are **workspace-relative**, not relative to the debug location:

```json
{
  "dotenv": "./config/.env",  // Relative to workspace root
  "binary": "./dist/app.wasm" // Relative to workspace root
}
```

**Workspace structure:**
```
my-workspace/           ← Workspace root
├── .vscode/
│   └── launch.json
├── config/
│   └── .env           ← Resolved from workspace root
├── dist/
│   └── app.wasm       ← Resolved from workspace root
└── src/
    └── main.rs
```

## Real-World Examples

### Example 1: Development Setup

```json
{
  "type": "fastedge",
  "name": "Dev Server",
  "request": "launch",
  "port": 8181,
  "dotenv": true,
  "env": {
    "NODE_ENV": "development"
  },
  "traceLogging": true
}
```

```bash
# .env (gitignored)
FASTEDGE_VAR_SECRET_API_KEY=dev-key-12345
FASTEDGE_VAR_ENV_LOG_LEVEL=debug
```

### Example 2: Production Testing

```json
{
  "type": "fastedge",
  "name": "Prod Test",
  "request": "launch",
  "port": 8080,
  "dotenv": "./config/.env.production",
  "geoIpHeaders": true,
  "headers": {
    "x-environment": "production-test"
  }
}
```

### Example 3: Pre-compiled Binary

```json
{
  "type": "fastedge",
  "name": "Test Binary",
  "request": "launch",
  "binary": "./dist/app.wasm",
  "port": 9000,
  "headers": {
    "x-test-mode": "true"
  }
}
```

Skips compilation, uses pre-built WASM file.

### Example 4: Geo-Location Testing

```json
{
  "type": "fastedge",
  "name": "Geo Test",
  "request": "launch",
  "geoIpHeaders": true,
  "headers": {
    "x-real-ip": "8.8.8.8"
  }
}
```

Injects geo-location headers based on IP address.
