# Integration Testing

**Status**: ✅ Complete - Full Property Coverage (17/17 Properties Tested)
**Last Updated**: February 10, 2026

---

## Overview

The proxy-runner uses compiled WASM test applications for integration testing to ensure production parity with FastEdge CDN behavior. Integration tests verify the complete flow from WASM execution through property access control, header manipulation, and request/response handling.

---

## Test Application Structure

### Directory Organization

```
test-applications/
├── cdn-apps/                     # Proxy-WASM CDN applications
│   └── properties/               # Property access control testing
│       ├── assembly/             # AssemblyScript source files (12 test apps)
│       │   ├── valid-path-write.ts              # ReadWrite: request.path
│       │   ├── valid-url-write.ts               # ReadWrite: request.url
│       │   ├── valid-host-write.ts              # ReadWrite: request.host
│       │   ├── valid-query-write.ts             # ReadWrite: request.query
│       │   ├── invalid-method-write.ts          # ReadOnly: request.method
│       │   ├── invalid-scheme-write.ts          # ReadOnly: request.scheme
│       │   ├── invalid-geolocation-write.ts     # ReadOnly: request.country
│       │   ├── valid-response-status-read.ts    # Response: read status
│       │   ├── invalid-response-status-write.ts # Response: deny write
│       │   ├── valid-nginx-log-write.ts         # WriteOnly: nginx.log_field1
│       │   ├── valid-readonly-read.ts           # ReadOnly: all 8 read-only properties
│       │   └── invalid-readonly-write.ts        # ReadOnly: deny writes to 8 properties
│       ├── package.json          # Build configuration
│       ├── asconfig.json         # AssemblyScript compiler config
│       └── README.md             # Test app documentation
│
wasm/                             # Compiled WASM binaries (generated)
└── cdn-apps/
    └── properties/               # 12 compiled WASM binaries
        ├── valid-path-write.wasm
        ├── valid-url-write.wasm
        ├── valid-host-write.wasm
        ├── valid-query-write.wasm
        ├── invalid-method-write.wasm
        ├── invalid-scheme-write.wasm
        ├── invalid-geolocation-write.wasm
        ├── valid-response-status-read.wasm
        ├── invalid-response-status-write.wasm
        ├── valid-nginx-log-write.wasm
        ├── valid-readonly-read.wasm
        └── invalid-readonly-write.wasm

server/__tests__/integration/     # Integration test files
├── property-access/             # Modular property access tests (35 tests)
│   ├── read-write-properties.test.ts    # Tests for ReadWrite properties
│   ├── read-only-properties.test.ts     # Tests for ReadOnly properties
│   ├── all-readonly-properties.test.ts  # Comprehensive read-only property tests (16 tests)
│   ├── response-properties.test.ts      # Tests for response properties
│   ├── nginx-properties.test.ts         # Tests for nginx properties
│   └── cross-hook-access.test.ts        # Tests for cross-hook access
├── utils/
│   ├── wasm-loader.ts           # WASM binary loading utilities
│   ├── test-helpers.ts          # Test helpers and assertions
│   └── property-assertions.ts   # Property-specific assertions
└── fixtures/
    └── property-test-data.ts    # Common test data and constants
```

### Test Applications

The test suite now includes **12 test applications** covering **17 properties** (100% of built-in properties) across **4 property access patterns**:

#### Read-Write Properties (4 apps)

1. **`valid-path-write.ts`** - Tests `request.path` write in onRequestHeaders
   - ✅ Expected: Write succeeds, value changes to `/new-path`

2. **`valid-url-write.ts`** - Tests `request.url` write in onRequestHeaders
   - ✅ Expected: Write succeeds, full URL modified

3. **`valid-host-write.ts`** - Tests `request.host` write in onRequestHeaders
   - ✅ Expected: Write succeeds, host changed

4. **`valid-query-write.ts`** - Tests `request.query` write in onRequestHeaders
   - ✅ Expected: Write succeeds, query string modified

#### Read-Only Properties (3 apps)

5. **`invalid-method-write.ts`** - Tests `request.method` write denial
   - ❌ Expected: Write denied, method stays GET, violation logged

6. **`invalid-scheme-write.ts`** - Tests `request.scheme` write denial
   - ❌ Expected: Write denied, scheme stays https, violation logged

7. **`invalid-geolocation-write.ts`** - Tests `request.country` write denial
   - ❌ Expected: Write denied, country unchanged, violation logged

8. **`valid-readonly-read.ts`** - Tests reading all 8 read-only properties
   - Properties: `request.extension`, `request.city`, `request.asn`, `request.geo.lat`, `request.geo.long`, `request.region`, `request.continent`, `request.country.name`
   - ✅ Expected: All reads succeed, values logged from test-config.json

9. **`invalid-readonly-write.ts`** - Tests write denial for all 8 read-only properties
   - Properties: Same as `valid-readonly-read.ts`
   - ❌ Expected: All writes denied, values unchanged, violations logged

#### Response Properties (2 apps)

10. **`valid-response-status-read.ts`** - Tests `response.status` read in onResponseHeaders
    - ✅ Expected: Read succeeds, status value logged

11. **`invalid-response-status-write.ts`** - Tests `response.status` write denial
    - ❌ Expected: Write denied, status unchanged, violation logged

#### Write-Only Properties (1 app)

12. **`valid-nginx-log-write.ts`** - Tests `nginx.log_field1` write
    - ✅ Expected: Write succeeds, no violations

---

## Building Test Applications

### Build Commands

```bash
# Build all test WASM binaries
pnpm build:test-apps

# Build specific test app
pnpm --filter cdn_properties build

# Clean and rebuild
pnpm --filter cdn_properties run clean && pnpm --filter cdn_properties build
```

### Build Process

1. AssemblyScript source files in `test-applications/cdn-apps/properties/assembly/*.ts`
2. Compiled using `asc` (AssemblyScript compiler) with optimization
3. Output WASM binaries to `wasm/cdn-apps/properties/*.wasm`
4. Output WAT (text format) for debugging

### Dependencies

Test applications use:
- `@gcoredev/proxy-wasm-sdk-as` - G-Core FastEdge SDK for AssemblyScript
- `assemblyscript` - AssemblyScript compiler
- `npm-run-all2` - Parallel build script execution

---

## Running Integration Tests

### Test Commands

```bash
# Run integration tests only
pnpm test:integration

# Run all tests (unit + integration)
pnpm test:all

# Run integration tests in watch mode
vitest --config vitest.integration.config.ts

# Run specific test file
vitest server/__tests__/integration/property-access/read-write-properties.test.ts
```

### Test Configuration

Integration tests use `vitest.integration.config.ts`:
- **Test pattern**: `server/__tests__/integration/**/*.test.ts`
- **Timeout**: 10s (WASM compilation can be slow)
- **Environment**: Node.js

### Current Test Coverage

**35 passing tests** across **6 test files**:
- `read-write-properties.test.ts` - 4 tests (path, url, host, query)
- `read-only-properties.test.ts` - 6 tests (method, scheme, geolocation)
- `all-readonly-properties.test.ts` - 16 tests (8 read + 8 write denial tests for all read-only properties)
- `response-properties.test.ts` - 3 tests (status read/write)
- `nginx-properties.test.ts` - 2 tests (write-only property)
- `cross-hook-access.test.ts` - 4 tests (cross-hook patterns)

## Modular Test Structure

The integration tests are organized by property type for better maintainability:

### Why Modular?

- **Scalability**: Adding 15+ test apps to one file creates a 300+ line monolith
- **Discoverability**: Developers can find tests by property category
- **Focused Testing**: Each file tests a specific aspect of property access
- **Easy Maintenance**: Changes to one property type don't affect others

### File Organization

```
server/__tests__/integration/property-access/
├── read-write-properties.test.ts    # ~50 lines, 4 tests
├── read-only-properties.test.ts     # ~60 lines, 6 tests
├── all-readonly-properties.test.ts  # ~450 lines, 16 tests (comprehensive)
├── response-properties.test.ts      # ~40 lines, 3 tests
├── nginx-properties.test.ts         # ~35 lines, 2 tests
└── cross-hook-access.test.ts        # ~50 lines, 4 tests
```

Most files are **focused and maintainable** (under 70 lines), making it easy to:
- Add new tests for the same property type
- Update assertions for specific property behaviors
- Debug failures in a specific category

---

## Writing Integration Tests

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { ProxyWasmRunner } from '../../runner/ProxyWasmRunner';
import { loadCdnAppWasm, WASM_TEST_BINARIES } from './utils/wasm-loader';
import {
  createTestRunner,
  createHookCall,
  hasPropertyAccessViolation,
  logsContain,
} from './utils/test-helpers';

describe('My Integration Test', () => {
  let runner: ProxyWasmRunner;
  let wasmBinary: Uint8Array;

  beforeEach(async () => {
    // Create test runner with property access control enabled
    runner = createTestRunner(true);

    // Load WASM binary
    wasmBinary = await loadCdnAppWasm(
      'properties',
      WASM_TEST_BINARIES.cdnApps.properties.validPathWrite
    );
  });

  it('should test something', async () => {
    // Load WASM into runner
    await runner.load(Buffer.from(wasmBinary));

    // Execute hook
    const result = await runner.callHook(createHookCall('onRequestHeaders', {
      ':method': 'GET',
      ':path': '/test',
      ':authority': 'example.com',
      ':scheme': 'https',
    }));

    // Assert results
    expect(hasPropertyAccessViolation(result)).toBe(false);
    expect(logsContain(result, 'Expected log message')).toBe(true);
  });
});
```

### Test Utilities

#### `createTestRunner(fastEdgeConfig?)`
Creates a ProxyWasmRunner instance configured for testing with property access control ALWAYS enforced.

**Parameters**:
- `fastEdgeConfig` (optional): FastEdge configuration for secrets/dictionary

**Returns**: ProxyWasmRunner instance

**Example**:
```typescript
const runner = createTestRunner(); // Production rules enforced
```

**Note**: Property access control is always enabled in integration tests for production parity.

#### `createHookCall(hook, headers?, body?)`
Creates a HookCall object for testing.

**Parameters**:
- `hook`: Hook name (`'onRequestHeaders'` | `'onRequestBody'` | `'onResponseHeaders'` | `'onResponseBody'`)
- `headers`: Optional request headers (defaults to GET /test)
- `body`: Optional request body

**Returns**: HookCall object with proper structure

**Example**:
```typescript
const call = createHookCall('onRequestHeaders', {
  ':method': 'POST',
  ':path': '/api/endpoint',
  ':authority': 'api.example.com',
  ':scheme': 'https',
  'content-type': 'application/json',
});
```

#### `hasPropertyAccessViolation(result)`
Checks if hook result contains property access violations.

**Parameters**:
- `result`: HookResult from callHook()

**Returns**: Boolean (true if violations found)

#### `getPropertyAccessViolations(result)`
Extracts property access violation messages from logs.

**Parameters**:
- `result`: HookResult from callHook()

**Returns**: Array of violation log messages

#### `logsContain(result, substring)`
Checks if logs contain a specific message.

**Parameters**:
- `result`: HookResult from callHook()
- `substring`: String to search for in log messages

**Returns**: Boolean (true if found)

### Property Assertion Utilities

New property-specific assertions in `property-assertions.ts`:

#### `assertPropertyReadable(result, propertyPath, expectedValue?)`
Asserts that a property was successfully read.

**Parameters**:
- `result`: HookResult from callHook()
- `propertyPath`: Property path (e.g., `'request.path'`)
- `expectedValue` (optional): Expected value in logs

**Example**:
```typescript
assertPropertyReadable(result, 'request.path', '/test');
```

#### `assertPropertyWritable(result, propertyPath, expectedValue)`
Asserts that a property was successfully written.

**Parameters**:
- `result`: HookResult from callHook()
- `propertyPath`: Property path
- `expectedValue`: Expected new value in logs

**Example**:
```typescript
assertPropertyWritable(result, 'request.path', '/new-path');
```

#### `assertPropertyDenied(result, propertyPath, operation)`
Asserts that a property access was denied.

**Parameters**:
- `result`: HookResult from callHook()
- `propertyPath`: Property path
- `operation`: `'read'` or `'write'`

**Example**:
```typescript
assertPropertyDenied(result, 'request.method', 'write');
```

#### `assertLogContains(result, message)`
Asserts that logs contain a specific message.

**Parameters**:
- `result`: HookResult from callHook()
- `message`: Message to find in logs

**Example**:
```typescript
assertLogContains(result, 'Successfully wrote to nginx.log_field1');
```

#### `loadCdnAppWasm(subCategory, filename)`
Loads a compiled WASM binary for CDN apps.

**Parameters**:
- `subCategory`: Subfolder name (e.g., `'properties'`)
- `filename`: WASM filename (e.g., `'valid-path-write.wasm'`)

**Returns**: Promise<Uint8Array> - WASM binary data

**Example**:
```typescript
const wasm = await loadCdnAppWasm('properties', 'valid-path-write.wasm');
// Or use constants:
const wasm = await loadCdnAppWasm(
  'properties',
  WASM_TEST_BINARIES.cdnApps.properties.validPathWrite
);
```

---

## Full-Flow Testing with Downstream Services

Full-flow tests validate the complete request/response cycle through a CDN app that makes downstream HTTP calls. This ensures production parity for CDN apps that act as proxies or edge functions.

### Architecture

```
Test Setup:
  ┌─────────────────┐
  │ HTTP WASM App   │  (Spawned on port 8100)
  │ (http-responder)│  Acts as downstream service
  └─────────────────┘
           ↑
           │ HTTP fetch
           │
  ┌─────────────────┐
  │ CDN App         │  (headers-change)
  │ (proxy-wasm)    │  Processes request/response
  └─────────────────┘
           ↑
           │ callFullFlow()
           │
  ┌─────────────────┐
  │ Integration Test│
  └─────────────────┘
```

### Test Flow

1. **Spawn Downstream Service**: Use `spawnDownstreamHttpApp()` to start an HTTP WASM app
2. **Load CDN App**: Load the proxy-wasm CDN app with `ProxyWasmRunner`
3. **Execute Full Flow**: Call `callFullFlow()` with downstream URL
4. **Verify Results**: Check that all 4 hooks executed and modifications propagated

### Example: Headers-Change with HTTP Responder

```typescript
import { spawnDownstreamHttpApp } from '../../utils/http-wasm-helpers';
import { createTestRunner } from '../../utils/test-helpers';
import { loadCdnAppWasm, loadHttpAppWasm, WASM_TEST_BINARIES } from '../../utils/wasm-loader';

describe('Full-Flow: CDN Headers-Change with Downstream', () => {
  let downstreamRunner: IWasmRunner;
  let downstreamPort: number;
  let cdnRunner: ProxyWasmRunner;

  beforeAll(async () => {
    // Step 1: Spawn downstream HTTP service
    const httpResponderWasm = await loadHttpAppWasm(
      'basic-examples',
      WASM_TEST_BINARIES.httpApps.basicExamples.httpResponder
    );

    const downstream = await spawnDownstreamHttpApp(httpResponderWasm, 8100);
    downstreamRunner = downstream.runner;
    downstreamPort = downstream.port;

    // Step 2: Load CDN app
    cdnRunner = createTestRunner();
    const cdnWasm = await loadCdnAppWasm(
      'headers',
      WASM_TEST_BINARIES.cdnApps.headers.headersChange
    );
    await cdnRunner.load(Buffer.from(cdnWasm));
  }, 40000);

  afterAll(async () => {
    if (downstreamRunner) {
      await downstreamRunner.cleanup();
    }
  });

  it('should complete full flow with header injection', async () => {
    const downstreamUrl = `http://localhost:${downstreamPort}/test`;

    // Execute full flow
    const result = await cdnRunner.callFullFlow(
      downstreamUrl,
      'GET',
      {}, // Request headers
      '', // Request body
      {}, // Response headers (filled by downstream)
      '', // Response body (filled by downstream)
      200,
      'OK',
      {}, // Properties
      true // Enforce production property rules
    );

    // Verify all hooks executed
    expect(result.hookResults.onRequestHeaders).toBeDefined();
    expect(result.hookResults.onRequestBody).toBeDefined();
    expect(result.hookResults.onResponseHeaders).toBeDefined();
    expect(result.hookResults.onResponseBody).toBeDefined();

    // Verify final response from downstream
    expect(result.finalResponse.status).toBe(200);
    expect(result.finalResponse.body).toBeTruthy();

    // Verify modifications propagated
    const responseData = JSON.parse(result.finalResponse.body);
    expect(responseData.reqHeaders['x-custom-request']).toBe('I am injected from onRequestHeaders');
    expect(result.finalResponse.headers['x-custom-response']).toBe('I am injected from onResponseHeaders');
  });
});
```

### spawnDownstreamHttpApp Helper

The `spawnDownstreamHttpApp()` helper in `utils/http-wasm-helpers.ts` spawns an HTTP WASM app as a downstream service:

```typescript
const downstream = await spawnDownstreamHttpApp(wasmBinary, 8100);
// Returns: { runner: IWasmRunner, port: number }
```

**Parameters**:
- `wasmBinary` - Compiled HTTP WASM binary (Uint8Array)
- `expectedPort` - Expected port number (default 8100)

**Returns**:
- `runner` - HttpWasmRunner instance for cleanup
- `port` - Port number the service is running on

### Full Flow Verification Points

When testing full flow, verify:

1. **All 4 Hooks Execute**:
   - `result.hookResults.onRequestHeaders` defined
   - `result.hookResults.onRequestBody` defined
   - `result.hookResults.onResponseHeaders` defined
   - `result.hookResults.onResponseBody` defined

2. **Request Modifications Reach Downstream**:
   - Check `result.finalResponse.body` for downstream's echo of request
   - Verify headers added in onRequestHeaders are present
   - Verify body modifications in onRequestBody are present

3. **Response Modifications Applied**:
   - Check `result.finalResponse.headers` for headers added in onResponseHeaders
   - Check `result.finalResponse.body` for body modifications in onResponseBody

4. **Logs Captured**:
   - Each hook's logs should be non-empty
   - Verify debug messages show expected operations

### Log Level in Full Flow

The `callFullFlow()` method accepts an optional `logLevel` parameter:

```typescript
await cdnRunner.callFullFlow(
  url, method, headers, body,
  responseHeaders, responseBody,
  status, statusText,
  properties, enforceRules,
  0 // logLevel: 0 = Trace (capture all logs)
);
```

**Log Levels**:
- `0` - Trace (all logs)
- `1` - Debug
- `2` - Info (default)
- `3` - Warn
- `4` - Error

**Default**: `0` (Trace) to capture all logs including debug messages

### Port Management

- HTTP WASM runners use `PortManager` which allocates from 8100-8199
- Sequential allocation: first runner gets 8100, second gets 8101, etc.
- Shared `PortManager` instance prevents conflicts across tests
- Ports are released when `runner.cleanup()` is called

### Best Practices

1. **Spawn Once**: Spawn downstream services in `beforeAll()` for performance
2. **Cleanup Always**: Always call `runner.cleanup()` in `afterAll()`
3. **Port Conflicts**: If tests fail with EADDRINUSE, ensure cleanup is working
4. **Timeouts**: Use longer timeouts (40s) for `beforeAll()` when spawning multiple runners
5. **Test Independence**: Each test should be independent and not rely on state from previous tests

### Test Location

Full-flow tests are located in:
```
server/__tests__/integration/cdn-apps/full-flow/
```

This separates them from single-hook tests in `property-access/` and other test categories.

---

## Adding New Test Applications

### Step 1: Create AssemblyScript Source

Create new `.ts` file in `test-applications/cdn-apps/{category}/assembly/`:

```typescript
export * from "@gcoredev/proxy-wasm-sdk-as/assembly/proxy";
import {
  Context,
  FilterHeadersStatusValues,
  get_property,
  log,
  LogLevelValues,
  registerRootContext,
  set_property,
  RootContext,
} from "@gcoredev/proxy-wasm-sdk-as/assembly";

class MyTestRoot extends RootContext {
  createContext(context_id: u32): Context {
    return new MyTestContext(context_id, this);
  }
}

class MyTestContext extends Context {
  constructor(context_id: u32, root_context: MyTestRoot) {
    super(context_id, root_context);
  }

  onRequestHeaders(a: u32, end_of_stream: bool): FilterHeadersStatusValues {
    log(LogLevelValues.info, "Testing my feature");

    // Your test logic here

    return FilterHeadersStatusValues.Continue;
  }
}

registerRootContext((context_id: u32) => {
  return new MyTestRoot(context_id);
}, "myTest");
```

### Step 2: Add Build Script

Update `test-applications/cdn-apps/{category}/package.json`:

```json
{
  "scripts": {
    "build:all": "npm-run-all -p build:existing build:my-test",
    "build:my-test": "asc assembly/my-test.ts --target release --outFile build/my-test.wasm --textFile build/my-test.wat --sourceMap --optimize"
  }
}
```

### Step 3: Update WASM Constants

Add to `server/__tests__/integration/utils/wasm-loader.ts`:

```typescript
export const WASM_TEST_BINARIES = {
  cdnApps: {
    properties: {
      validPathWrite: 'valid-path-write.wasm',
      invalidMethodWrite: 'invalid-method-write.wasm',
      myTest: 'my-test.wasm', // Add your test
    },
  },
} as const;
```

### Step 4: Write Integration Tests

Create test file in `server/__tests__/integration/my-feature.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { ProxyWasmRunner } from '../../runner/ProxyWasmRunner';
import { loadCdnAppWasm, WASM_TEST_BINARIES } from './utils/wasm-loader';
import { createTestRunner, createHookCall, logsContain } from './utils/test-helpers';

describe('My Feature - Integration Tests', () => {
  let runner: ProxyWasmRunner;
  let wasmBinary: Uint8Array;

  beforeEach(async () => {
    runner = createTestRunner(true);
    wasmBinary = await loadCdnAppWasm(
      'properties',
      WASM_TEST_BINARIES.cdnApps.properties.myTest
    );
  });

  it('should test my feature', async () => {
    await runner.load(Buffer.from(wasmBinary));

    const result = await runner.callHook(createHookCall('onRequestHeaders'));

    expect(logsContain(result, 'Testing my feature')).toBe(true);
  });
});
```

### Step 5: Build and Test

```bash
# Build new WASM binary
pnpm build:test-apps

# Verify WASM was created
ls -la wasm/cdn-apps/properties/my-test.wasm

# Run integration tests
pnpm test:integration
```

---

## Best Practices

### Test Application Design

1. **Keep tests focused**: Each test app should verify one specific behavior
2. **Use descriptive names**: Filename should indicate what's being tested
3. **Log important steps**: Use `log()` to output key checkpoints
4. **Test both success and failure**: Create apps for expected passes and expected failures

### Integration Test Design

1. **Test real WASM binaries**: Don't mock - use actual compiled WASM
2. **Verify production parity**: Tests should match FastEdge CDN behavior
3. **Check logs**: Verify logging output, especially for violations
4. **Use test helpers**: Leverage utilities for cleaner tests
5. **Set log level**: Use `logLevel: 0` in test calls to capture all logs

### Debugging

**If test app won't compile:**
1. Check `package.json` has correct dependencies
2. Verify `asconfig.json` is properly configured
3. Check for SDK API changes
4. Look at existing working test apps for patterns

**If integration test fails:**
1. Check WASM binary exists in `wasm/` directory
2. Verify log level is set to capture messages (default 2 = Info)
3. Add `console.log(result.logs)` to see what logs are captured
4. Check property access control is configured correctly

**Common issues:**
- Empty logs array → Log level too high, set to 0 (Trace)
- WASM not found → Run `pnpm build:test-apps` first
- Property violations → Check if enforcement is enabled/disabled correctly

---

## Future Enhancements

### Planned Test Categories

1. **cdn-headers** - Header manipulation testing
   - Adding headers
   - Removing headers
   - Modifying header values
   - Header serialization format

2. **http-apps** - WASI-HTTP testing (when scope expands)
   - HTTP client requests
   - Response handling
   - WASI-HTTP specific features

3. **custom-properties** - Custom property testing
   - Context boundaries
   - Property chaining between hooks
   - Persistence rules

### Test Coverage Goals

**Completed**:
- ✅ Property access control (read-only, read-write, write-only)
- ✅ Property access violations and denial logging
- ✅ ReadWrite properties: path, url, host, query (4/4) - 100% coverage
- ✅ ReadOnly properties: method, scheme, country, extension, city, asn, geo.lat, geo.long, region, continent, country.name (11/11) - 100% coverage
- ✅ Response properties: status read/write (1/1) - 100% coverage
- ✅ WriteOnly properties: nginx.log_field1 (1/1) - 100% coverage
- ✅ Hook context isolation (onRequestHeaders, onResponseHeaders)
- ✅ Modular test structure for scalability
- ✅ **All 17 built-in properties tested (100% coverage)**
- ✅ **Full-flow testing with downstream HTTP services**
- ✅ **All 4 hooks tested in full request/response cycle (onRequestHeaders, onRequestBody, onResponseHeaders, onResponseBody)**
- ✅ **Header manipulation testing through full flow**
- ✅ **Body modification testing (request and response JSON injection)**

**Planned**:
- ⏳ Custom property context boundaries
- ⏳ FastEdge secrets/dictionary integration in full-flow tests
- ⏳ Additional downstream service patterns (multiple downstreams, error handling)
- ⏳ Performance benchmarking for full-flow execution

---

## Related Documentation

- `context/development/TESTING_GUIDE.md` - Unit testing patterns
- `context/development/TEST_PATTERNS.md` - Testing conventions
- `context/features/PROPERTY_IMPLEMENTATION_COMPLETE.md` - Property access control details
- `server/runner/__tests__/PropertyAccessControl.test.ts` - Unit test examples
