import { useState } from "react";
import { useWasm } from "./hooks/useWasm";
import { WasmLoader } from "./components/WasmLoader";
import { RequestBar } from "./components/RequestBar";
import { RequestTabs } from "./components/RequestTabs";
import { TriggerPanel } from "./components/TriggerPanel";
import { ResponseTabs } from "./components/ResponseTabs";
import { HookResult } from "./types";
import "./App.css";

function App() {
  const { wasmState, loading, error, loadWasm } = useWasm();

  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://example.com/api/endpoint");

  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({
    host: "example.com",
    "content-type": "application/json",
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

  const [logLevel, setLogLevel] = useState(2);
  const [results, setResults] = useState<Record<string, HookResult>>({});

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
        onMethodChange={setMethod}
        onUrlChange={setUrl}
      />

      <RequestTabs
        headers={requestHeaders}
        body={requestBody}
        properties={properties}
        onHeadersChange={setRequestHeaders}
        onBodyChange={setRequestBody}
        onPropertiesChange={setProperties}
      />

      <TriggerPanel
        wasmLoaded={wasmState.wasmPath !== null}
        hookCall={hookCall}
        logLevel={logLevel}
        onLogLevelChange={setLogLevel}
        onResult={handleResult}
      />

      <ResponseTabs results={results} />
    </div>
  );
}

export default App;
