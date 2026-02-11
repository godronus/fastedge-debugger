import { useEffect, useRef } from "react";
import { useAppStore } from "./stores";
import { useWebSocket } from "./hooks/useWebSocket";
import type { ServerEvent } from "./hooks/websocket-types";
import { WasmLoader } from "./components/common/WasmLoader";
import { ConnectionStatus } from "./components/common/ConnectionStatus";
import { LoadingSpinner } from "./components/common/LoadingSpinner";
import { HttpWasmView } from "./views/HttpWasmView";
import { ProxyWasmView } from "./views/ProxyWasmView";
import { loadConfig as loadConfigAPI, saveConfig as saveConfigAPI } from "./api";
import "./App.css";

function App() {
  // Get state and actions from stores
  const {
    // WASM state
    wasmPath,
    wasmFile,
    wasmType,
    loading,
    error,
    loadWasm,
    reloadWasm,
    loadingMode,
    loadTime,
    fileSize,

    // Proxy-WASM state (for WebSocket event handling)
    setUrl,
    setMethod,
    setRequestHeaders,
    setHookResults,
    setFinalResponse,
    hookResults,
    properties,
    mergeProperties,

    // HTTP WASM state (for WebSocket event handling)
    setHttpResponse,
    setHttpLogs,

    // Config state
    dotenvEnabled,
    loadFromConfig,
    exportConfig,

    // UI state
    wsStatus,
    setWsStatus,
  } = useAppStore();

  // WebSocket connection for real-time updates
  const { status } = useWebSocket({
    autoConnect: true,
    debug: true, // Enable debug logging to console
    onEvent: handleServerEvent,
  });

  // Sync WebSocket status to store
  useEffect(() => {
    setWsStatus(status);
  }, [status, setWsStatus]);

  // Track if this is the initial mount to avoid reloading WASM on mount
  const isInitialMount = useRef(true);

  // Reload WASM when dotenv toggle changes (only if WASM is already loaded)
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (wasmFile) {
      console.log(
        `[App] Dotenv toggle changed to ${dotenvEnabled}, reloading WASM...`,
      );
      reloadWasm(dotenvEnabled);
    }
  }, [dotenvEnabled, wasmFile, reloadWasm]);

  /**
   * Handle WebSocket events from server
   * This keeps UI in sync with server state regardless of source (UI, AI agent, API)
   */
  function handleServerEvent(event: ServerEvent) {
    console.log(`[App] Received ${event.type} from ${event.source}`);

    switch (event.type) {
      case "wasm_loaded":
        // WASM loaded event - could update UI to show loaded binary
        console.log(
          `WASM loaded: ${event.data.filename} (${event.data.size} bytes)`,
        );
        break;

      case "request_started":
        // Request started - update URL and method in UI (for proxy-wasm)
        setUrl(event.data.url);
        setMethod(event.data.method);
        setRequestHeaders(event.data.headers);
        // Clear previous results
        setHookResults({});
        setFinalResponse(null);
        break;

      case "hook_executed":
        // Individual hook executed - update hook results incrementally (for proxy-wasm)
        const hookName = event.data.hook;
        setHookResults({
          ...hookResults,
          [hookName]: {
            logs: [], // Will be populated by request_completed
            returnValue: event.data.returnCode ?? undefined,
            input: event.data.input,
            output: event.data.output,
          },
        });
        break;

      case "request_completed":
        // Full request completed (for proxy-wasm) - update all results and final response
        setHookResults(event.data.hookResults);
        setFinalResponse(event.data.finalResponse);

        // Update calculated properties from WebSocket event
        console.log(
          "[WebSocket] request_completed calculatedProperties:",
          event.data.calculatedProperties,
        );
        if (event.data.calculatedProperties) {
          console.log("[WebSocket] Updating properties. Previous:", properties);
          const propsToMerge: Record<string, string> = {};
          for (const [key, value] of Object.entries(
            event.data.calculatedProperties,
          )) {
            propsToMerge[key] = String(value);
          }
          console.log("[WebSocket] Merging properties:", propsToMerge);
          mergeProperties(propsToMerge);
        }
        break;

      case "request_failed":
        // Request failed (for proxy-wasm) - show error
        const errorResult = {
          logs: [],
          returnValue: undefined,
          error: event.data.error,
        };
        setHookResults({
          onRequestHeaders: errorResult,
          onRequestBody: errorResult,
          onResponseHeaders: errorResult,
          onResponseBody: errorResult,
        });
        setFinalResponse(null);
        break;

      case "http_wasm_request_completed":
        // HTTP WASM request completed - update response and logs
        console.log("[WebSocket] http_wasm_request_completed:", event.data);
        setHttpResponse(event.data.response);
        setHttpLogs(event.data.logs);
        break;

      case "properties_updated":
        // Properties updated externally (for proxy-wasm)
        mergeProperties(event.data.properties);
        break;

      case "connection_status":
        // Connection status update - handled by useWebSocket
        break;
    }
  }

  /**
   * Load configuration from test-config.json
   */
  const handleLoadConfig = async () => {
    try {
      const config = await loadConfigAPI();

      // Load config into store
      loadFromConfig(config);

      alert("✅ Configuration loaded successfully!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`❌ Failed to load config: ${msg}`);
    }
  };

  /**
   * Save current configuration to test-config.json
   */
  const handleSaveConfig = async () => {
    try {
      const config = exportConfig();
      await saveConfigAPI(config);
      alert("✅ Configuration saved to test-config.json!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`❌ Failed to save config: ${msg}`);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>
          {wasmType === 'http-wasm' ? 'HTTP WASM Debugger' :
           wasmType === 'proxy-wasm' ? 'Proxy-WASM Test Runner' :
           'FastEdge WASM Debugger'}
        </h1>
        <ConnectionStatus status={wsStatus} />
      </header>

      {error && <div className="error">{error}</div>}

      <WasmLoader
        onFileLoad={(file) => loadWasm(file, dotenvEnabled)}
        loading={loading}
        onLoadConfig={wasmType === 'proxy-wasm' ? handleLoadConfig : undefined}
        onSaveConfig={wasmType === 'proxy-wasm' ? handleSaveConfig : undefined}
        loadingMode={loadingMode}
        loadTime={loadTime}
        fileSize={fileSize}
        fileName={wasmPath}
      />

      {/* Show loading spinner while detecting WASM type */}
      {loading && <LoadingSpinner message="Loading and detecting WASM type..." />}

      {/* Show appropriate view based on WASM type */}
      {!loading && !wasmPath && (
        <div className="empty-state">
          <p>👆 Load a WASM binary to get started</p>
        </div>
      )}

      {!loading && wasmPath && wasmType === 'http-wasm' && <HttpWasmView />}
      {!loading && wasmPath && wasmType === 'proxy-wasm' && <ProxyWasmView />}
    </div>
  );
}

export default App;
