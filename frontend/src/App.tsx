import { useState } from "react";
import { useWasm } from "./hooks/useWasm";
import { useWebSocket } from "./hooks/useWebSocket";
import type { ServerEvent } from "./hooks/websocket-types";
import { WasmLoader } from "./components/WasmLoader";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { RequestBar } from "./components/RequestBar";
import { RequestTabs } from "./components/RequestTabs";
import { ServerPropertiesPanel } from "./components/ServerPropertiesPanel";
import { HookStagesPanel } from "./components/HookStagesPanel";
import { ResponseViewer } from "./components/ResponseViewer";
import { HookResult, FinalResponse } from "./types";
import { applyDefaultContentType } from "./utils/contentType";
import { loadConfig, saveConfig, type TestConfig } from "./api";
import "./App.css";

function App() {
  const { wasmState, loading, error, loadWasm } = useWasm();

  // WebSocket connection for real-time updates
  const { status: wsStatus, lastEvent } = useWebSocket({
    autoConnect: true,
    debug: true, // Enable debug logging to console
    onEvent: handleServerEvent,
  });

  const [method, setMethod] = useState("POST");
  const [url, setUrl] = useState(
    "https://cdn-origin-4732724.fastedge.cdn.gc.onl/", // Initial test url - updated from http://localhost:8181 to make development easier
  );

  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>(
    {},
  );

  const [requestBody, setRequestBody] = useState('{"message": "Hello"}');

  const [responseHeaders, setResponseHeaders] = useState<
    Record<string, string>
  >({
    "content-type": "application/json",
  });

  const [responseBody, setResponseBody] = useState('{"response": "OK"}');

  const [properties, setProperties] = useState<Record<string, string>>({});
  const [dotenvEnabled, setDotenvEnabled] = useState(true); // Dotenv enabled by default

  const [logLevel, setLogLevel] = useState(0); // Trace
  const [results, setResults] = useState<Record<string, HookResult>>({});
  const [finalResponse, setFinalResponse] = useState<FinalResponse | null>(
    null,
  );

  const handleResult = (hook: string, result: HookResult) => {
    setResults((prev) => ({ ...prev, [hook]: result }));
  };

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
        setResults({});
        setFinalResponse(null);
        break;

      case "hook_executed":
        // Individual hook executed - update hook results incrementally
        const hookName = event.data.hook;
        setResults((prev) => ({
          ...prev,
          [hookName]: {
            logs: "", // Will be populated by request_completed
            returnValue: event.data.returnCode,
            input: event.data.input,
            output: event.data.output,
          },
        }));
        break;

      case "request_completed":
        // Full request completed - update all results and final response
        setResults(event.data.hookResults);
        setFinalResponse(event.data.finalResponse);

        // Update calculated properties from WebSocket event
        console.log(
          "[WebSocket] request_completed calculatedProperties:",
          event.data.calculatedProperties,
        );
        if (event.data.calculatedProperties) {
          setProperties((prev) => {
            console.log("[WebSocket] Updating properties. Previous:", prev);
            const merged = { ...prev };
            for (const [key, value] of Object.entries(
              event.data.calculatedProperties!,
            )) {
              merged[key] = String(value);
            }
            console.log("[WebSocket] New merged properties:", merged);
            return merged;
          });
        }
        break;

      case "request_failed":
        // Request failed - show error
        const errorResult = {
          logs: "",
          returnValue: undefined,
          error: event.data.error,
        };
        setResults({
          onRequestHeaders: errorResult,
          onRequestBody: errorResult,
          onResponseHeaders: errorResult,
          onResponseBody: errorResult,
        });
        setFinalResponse(null);
        break;

      case "properties_updated":
        // Properties updated externally
        setProperties(event.data.properties);
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
      const config = await loadConfig();

      // Apply configuration to state
      setMethod(config.request.method);
      setUrl(config.request.url);
      setRequestHeaders(config.request.headers);
      setRequestBody(config.request.body);
      setProperties(config.properties);
      setLogLevel(config.logLevel);

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
      const config: TestConfig = {
        description: "Test configuration for proxy-wasm debugging",
        wasm: {
          path: wasmState.wasmPath || "wasm/cdn_header_change.wasm",
          description: "Current loaded WASM binary",
        },
        request: {
          method,
          url,
          headers: requestHeaders,
          body: requestBody,
        },
        properties,
        logLevel,
      };

      await saveConfig(config);
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
        wasmLoaded={wasmState.wasmPath !== null}
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
              hookResults,
              finalResponse: response,
              calculatedProperties,
            } = await sendFullFlow(url, method, {
              ...hookCall,
              request_headers: finalHeaders,
              logLevel,
            });
            // Update hook results and final response
            setResults(hookResults);
            setFinalResponse(response);

            // Merge calculated properties into the UI
            // Always update calculated properties since they're runtime values
            // User-provided properties (country, city, etc.) aren't in calculatedProperties so they're preserved
            console.log(
              "[API] Received calculatedProperties:",
              calculatedProperties,
            );
            if (calculatedProperties) {
              setProperties((prev) => {
                console.log("[API] Updating properties. Previous:", prev);
                const merged = { ...prev };
                // Always update calculated properties - they change with each request
                for (const [key, value] of Object.entries(
                  calculatedProperties,
                )) {
                  merged[key] = String(value);
                }
                console.log("[API] New merged properties:", merged);
                return merged;
              });
            }
          } catch (err) {
            // Show error in all hooks
            const errorMsg =
              err instanceof Error ? err.message : "Unknown error";
            const errorResult = {
              logs: "",
              returnValue: undefined,
              error: errorMsg,
            };
            setResults({
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
        results={results}
        hookCall={hookCall}
        logLevel={logLevel}
        onLogLevelChange={setLogLevel}
      />

      <ResponseViewer response={finalResponse} />
    </div>
  );
}

export default App;
