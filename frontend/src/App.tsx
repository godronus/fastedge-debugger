import { useEffect, useRef } from "react";
import { useAppStore } from "./stores";
import { useWebSocket } from "./hooks/useWebSocket";
import type { ServerEvent } from "./hooks/websocket-types";
import { WasmLoader } from "./components/WasmLoader";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { RequestBar } from "./components/RequestBar";
import { RequestTabs } from "./components/RequestTabs";
import { ServerPropertiesPanel } from "./components/ServerPropertiesPanel";
import { HookStagesPanel } from "./components/HookStagesPanel";
import { ResponseViewer } from "./components/ResponseViewer";
import { applyDefaultContentType } from "./utils/contentType";
import { loadConfig as loadConfigAPI, saveConfig as saveConfigAPI } from "./api";
import "./App.css";

function App() {
  // Get state and actions from stores
  const {
    // Request state
    method,
    url,
    requestHeaders,
    requestBody,
    responseHeaders,
    responseBody,
    setMethod,
    setUrl,
    setRequestHeaders,
    setRequestBody,

    // WASM state
    wasmPath,
    wasmFile,
    loading,
    error,
    loadWasm,
    reloadWasm,

    // Results state
    hookResults,
    finalResponse,
    setHookResults,
    setFinalResponse,

    // Config state
    properties,
    dotenvEnabled,
    logLevel,
    setProperties,
    mergeProperties,
    setDotenvEnabled,
    setLogLevel,
    loadFromConfig,
    exportConfig,

    // UI state
    wsStatus,
    setWsStatus,
  } = useAppStore();

  // WebSocket connection for real-time updates
  const { status, lastEvent } = useWebSocket({
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
        // Request started - update URL and method in UI
        setUrl(event.data.url);
        setMethod(event.data.method);
        setRequestHeaders(event.data.headers);
        // Clear previous results
        setHookResults({});
        setFinalResponse(null);
        break;

      case "hook_executed":
        // Individual hook executed - update hook results incrementally
        const hookName = event.data.hook;
        setHookResults({
          ...hookResults,
          [hookName]: {
            logs: [], // Will be populated by request_completed
            returnValue: event.data.returnCode,
            input: event.data.input,
            output: event.data.output,
          },
        });
        break;

      case "request_completed":
        // Full request completed - update all results and final response
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
        // Request failed - show error
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

      case "properties_updated":
        // Properties updated externally
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

  const hookCall = {
    request_headers: requestHeaders,
    request_body: requestBody,
    request_trailers: {},
    response_headers: responseHeaders,
    response_body: responseBody,
    response_trailers: {},
    properties,
  };

  return (
    <div className="container">
      <header>
        <h1>Proxy-WASM Test Runner</h1>
        <ConnectionStatus status={wsStatus} />
      </header>

      {error && <div className="error">{error}</div>}

      <WasmLoader
        onFileLoad={(file) => loadWasm(file, dotenvEnabled)}
        loading={loading}
        onLoadConfig={handleLoadConfig}
        onSaveConfig={handleSaveConfig}
      />

      <RequestBar
        method={method}
        url={url}
        wasmLoaded={wasmPath !== null}
        onMethodChange={setMethod}
        onUrlChange={setUrl}
        onSend={async () => {
          try {
            const finalHeaders = applyDefaultContentType(
              requestHeaders,
              requestBody,
            );

            const { sendFullFlow } = await import("./api");
            const {
              hookResults: newHookResults,
              finalResponse: response,
              calculatedProperties,
            } = await sendFullFlow(url, method, {
              ...hookCall,
              request_headers: finalHeaders,
              logLevel,
            });

            // Update hook results and final response
            setHookResults(newHookResults);
            setFinalResponse(response);

            // Merge calculated properties into the UI
            console.log(
              "[API] Received calculatedProperties:",
              calculatedProperties,
            );
            if (calculatedProperties) {
              console.log("[API] Updating properties. Previous:", properties);
              const propsToMerge: Record<string, string> = {};
              // Always update calculated properties - they change with each request
              for (const [key, value] of Object.entries(calculatedProperties)) {
                propsToMerge[key] = String(value);
              }
              console.log("[API] Merging properties:", propsToMerge);
              mergeProperties(propsToMerge);
            }
          } catch (err) {
            // Show error in all hooks
            const errorMsg =
              err instanceof Error ? err.message : "Unknown error";
            const errorResult = {
              logs: [],
              returnValue: undefined,
              error: errorMsg,
            };
            setHookResults({
              onRequestHeaders: errorResult,
              onRequestBody: errorResult,
              onResponseHeaders: errorResult,
              onResponseBody: errorResult,
            });
            setFinalResponse(null);
          }
        }}
      />

      <RequestTabs
        headers={requestHeaders}
        body={requestBody}
        onHeadersChange={setRequestHeaders}
        onBodyChange={setRequestBody}
        defaultHeaders={{
          "user-agent": {
            value:
              "Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0",
            enabled: false,
            placeholder: "Browser user agent",
          },
          accept: {
            value:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            enabled: false,
            placeholder: "Browser accept types",
          },
          "accept-language": {
            value: "en-US,en;q=0.9",
            enabled: false,
            placeholder: "Browser languages",
          },
          "accept-encoding": {
            value: "gzip, deflate, br, zstd",
            enabled: false,
            placeholder: "Browser encodings",
          },
          host: {
            value: "",
            enabled: false,
            placeholder: "<Calculated from URL>",
          },
          "content-type": {
            value: "",
            enabled: false,
            placeholder: "<Calculated from body>",
          },
          Authorization: {
            value: "",
            enabled: false,
            placeholder: "Bearer <token>",
          },
        }}
      />

      <ServerPropertiesPanel
        properties={properties}
        onPropertiesChange={setProperties}
        dotenvEnabled={dotenvEnabled}
        onDotenvToggle={setDotenvEnabled}
      />

      <HookStagesPanel
        results={hookResults}
        hookCall={hookCall}
        logLevel={logLevel}
        onLogLevelChange={setLogLevel}
      />

      <ResponseViewer response={finalResponse} />
    </div>
  );
}

export default App;
