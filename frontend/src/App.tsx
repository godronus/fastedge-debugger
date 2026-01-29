import { useState } from "react";
import { useWasm } from "./hooks/useWasm";
import { WasmLoader } from "./components/WasmLoader";
import { RequestBar } from "./components/RequestBar";
import { RequestTabs } from "./components/RequestTabs";
import { HookStagesPanel } from "./components/HookStagesPanel";
import { ResponseViewer } from "./components/ResponseViewer";
import { HookResult, FinalResponse } from "./types";
import "./App.css";

function App() {
  const { wasmState, loading, error, loadWasm } = useWasm();

  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("http://localhost:8181");

  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({
    host: "example.com",
    "content-type": "application/json",
    "x-inject-body": "injected value from onRequestBody",
  });

  const [requestBody, setRequestBody] = useState('{"message": "Hello"}');

  const [responseHeaders, setResponseHeaders] = useState<
    Record<string, string>
  >({
    "content-type": "application/json",
  });

  const [responseBody, setResponseBody] = useState('{"response": "OK"}');

  const [properties, setProperties] = useState<Record<string, string>>({
    "my.custom.property": "test-value",
  });

  const [logLevel, setLogLevel] = useState(0); // Trace
  const [results, setResults] = useState<Record<string, HookResult>>({});
  const [finalResponse, setFinalResponse] = useState<FinalResponse | null>(
    null,
  );

  const handleResult = (hook: string, result: HookResult) => {
    setResults((prev) => ({ ...prev, [hook]: result }));
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
            const { sendFullFlow } = await import("./api");
            const { hookResults, finalResponse: response } = await sendFullFlow(
              url,
              method,
              {
                ...hookCall,
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
        properties={properties}
        onHeadersChange={setRequestHeaders}
        onBodyChange={setRequestBody}
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
