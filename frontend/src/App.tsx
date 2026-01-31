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
  const [url, setUrl] = useState("http://localhost:8181");

  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({
    "x-inject-req-body": "Injected WASM value onRequestBody",
    "x-inject-res-body": "Injected WASM value onResponseBody",
  });

  const [requestBody, setRequestBody] = useState('{"message": "Hello"}');

  const [responseHeaders, setResponseHeaders] = useState<
    Record<string, string>
  >({
    "content-type": "application/json",
  });

  const [responseBody, setResponseBody] = useState('{"response": "OK"}');

  const [properties, setProperties] = useState<Record<string, string>>({});

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

      <WasmLoader onFileLoad={loadWasm} loading={loading} />

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
            const { hookResults, finalResponse: response } = await sendFullFlow(
              url,
              method,
              {
                ...hookCall,
                request_headers: finalHeaders,
                logLevel,
              },
            );
            // Update hook results and final response
            setResults(hookResults);
            setFinalResponse(response);
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
          host: "example.com",
          "content-type": {
            value: "",
            enabled: false,
            placeholder: "<Calculated>",
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
