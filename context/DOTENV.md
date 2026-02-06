# DotEnv Configuration for Proxy-WASM Test Runner

This test runner supports dotenv files for configuring secrets and dictionary values during local development, following the same pattern as the [FastEdge VSCode extension](https://github.com/G-Core/FastEdge-vscode/blob/main/DOTENV.md).

## Overview

Instead of hard-coding secrets and configuration in `test-config.json`, you can use `.env` files to store sensitive data locally. This approach:

- Keeps sensitive data out of version control
- Matches production FastEdge behavior
- Simplifies local development workflow
- Prepares code for wasi-http component model integration

## File Structure

You can use either a single `.env` file with prefixes, or separate files for different types:

```
.
├── .env                  # Combined file with prefixes
├── .env.secrets          # Secrets only (no prefix needed)
└── .env.variables        # Dictionary/config values (no prefix needed)
```

## Usage Patterns

### Option 1: Single `.env` file with prefixes

```bash
# Secrets - accessed via proxy_get_secret()
FASTEDGE_VAR_SECRET_JWT_SECRET=my-secret-key
FASTEDGE_VAR_SECRET_API_KEY=sk_test_12345

# Dictionary - accessed via proxy_dictionary_get()
FASTEDGE_VAR_ENV_API_URL=https://api.example.com
FASTEDGE_VAR_ENV_LOG_LEVEL=debug
```

### Option 2: Separate files (no prefix needed)

**.env.secrets**

```bash
JWT_SECRET=my-secret-key
API_KEY=sk_test_12345
DATABASE_PASSWORD=postgres123
```

**.env.variables**

```bash
API_URL=https://api.example.com
LOG_LEVEL=debug
FEATURE_FLAG_NEW_UI=true
```

## Implementation Status

### ✅ Completed (February 2026)

- FastEdge host function implementation (proxy_get_secret, proxy_dictionary_get)
- SecretStore with time-based rotation support
- Dictionary for configuration values
- Type-safe TypeScript interfaces
- Integration into HostFunctions.ts
- Dotenv file parsing and loading (server/utils/dotenv-loader.ts)
- API endpoint updates (/api/load with dotenvEnabled parameter)
- Frontend UI for dotenv toggle (ServerPropertiesPanel component)
- Support for .env, .env.secrets, and .env.variables files
- Automatic loading on WASM load (default enabled)

### 📝 Notes

- Dotenv is enabled by default when loading WASM binaries
- Users can toggle dotenv loading via UI before loading WASM
- Server loads files from current directory (project root)
- Files are optional - missing files are silently ignored
- Supports both single .env with prefixes and separate files

## WASM Usage Examples

### Rust (proxy-wasm)

```rust
use proxy_wasm::traits::*;
use proxy_wasm::types::*;

// Get a secret
let jwt_secret = self.get_property(vec!["secret", "JWT_SECRET"])?;

// Get dictionary value
let api_url = self.get_property(vec!["dictionary", "API_URL"])?;
```

### JavaScript (wasi-http future support)

```javascript
import { getSecret } from "fastedge::secret";
import { getEnv } from "fastedge::env";

const jwtSecret = getSecret("JWT_SECRET");
const apiUrl = getEnv("API_URL");
```

## Security Notes

⚠️ **Important**: Always add `.env*` files to your `.gitignore`:

```gitignore
# Environment files
.env
.env.*
!.env.example
```

## File Hierarchy

Configuration values are resolved in this order (highest to lowest priority):

1. API request body (if provided)
2. `.env` file (with prefixes)
3. `.env.secrets` / `.env.variables` (separate files)
4. `test-config.json` fallback

## Future: wasi-http Component Model

This dotenv implementation is designed to align with future support for wasi-http component model applications. The same `.env` files will work seamlessly when the test runner is extended to support FastEdge HTTP WASM applications.

## References

- [FastEdge VSCode DOTENV.md](https://github.com/G-Core/FastEdge-vscode/blob/main/DOTENV.md)
- [FastEdge SDK Rust](https://github.com/G-Core/FastEdge-sdk-rust)
- [FastEdge SDK JS](https://github.com/G-Core/FastEdge-sdk-js)
- [FastEdge Runtime](https://github.com/G-Core/FastEdge-lib)

## Example Workflow

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your local secrets:

   ```bash
   FASTEDGE_VAR_SECRET_JWT_SECRET=your-actual-secret
   FASTEDGE_VAR_ENV_API_URL=http://localhost:3000
   ```

3. Load your WASM:

   ```bash
   # Future CLI usage (not yet implemented)
   npm run dev -- --dotenv .
   ```

4. The test runner will automatically load secrets and dictionary values from `.env` files

## Architecture

The dotenv support follows the same architecture as production FastEdge:

- **SecretStore**: Time-based secret rotation with effectiveAt timestamps
- **Dictionary**: Simple key-value configuration store
- **Host Functions**: WASM-compatible proxy_get_secret() and proxy_dictionary_get()
- **Memory Management**: Proper allocation and pointer handling for WASM

See [server/fastedge-host/](server/fastedge-host/) for implementation details.
