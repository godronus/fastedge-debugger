import { HookCall, HookResult } from "../types";

const API_BASE = "/api";

export async function uploadWasm(file: File): Promise<string> {
  // Read file as ArrayBuffer and convert to base64
  const buffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      "",
    ),
  );

  const response = await fetch(`${API_BASE}/load`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wasmBase64: base64 }),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "Failed to load WASM file");
  }

  const data = await response.json();
  return file.name; // Return filename as "path"
}

export async function callHook(
  hook: string,
  params: HookCall,
): Promise<HookResult> {
  const payload = {
    hook,
    request: {
      headers: params.request_headers || {},
      body: params.request_body || "",
      trailers: params.request_trailers || {},
    },
    response: {
      headers: params.response_headers || {},
      body: params.response_body || "",
      trailers: params.response_trailers || {},
    },
    properties: params.properties || {},
    // logLevel not sent - server always returns all logs for client-side filtering
  };

  const response = await fetch(`${API_BASE}/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || `Failed to call hook: ${hook}`);
  }

  const result = await response.json();
  const logs = result.result?.logs || [];
  return {
    logs: logs, // Keep as array for client-side filtering
    returnValue: result.result?.returnCode,
    error: result.error,
  };
}

export async function sendFullFlow(
  url: string,
  method: string,
  params: HookCall,
): Promise<{
  hookResults: Record<string, HookResult>;
  finalResponse: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    contentType: string;
    isBase64?: boolean;
  };
  calculatedProperties?: Record<string, unknown>;
}> {
  const payload = {
    url,
    request: {
      headers: params.request_headers || {},
      body: params.request_body || "",
      method: method || "GET",
    },
    response: {
      headers: params.response_headers || {},
      body: params.response_body || "",
    },
    properties: params.properties || {},
    // logLevel not sent - server always returns all logs for client-side filtering
  };

  const response = await fetch(`${API_BASE}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "Failed to execute full flow");
  }

  const result = await response.json();
  const hookResults: Record<string, HookResult> = {};

  // Transform each hook result
  for (const [hook, hookResult] of Object.entries(result.hookResults || {})) {
    const hr = hookResult as any;
    const logs = hr?.logs || [];
    hookResults[hook] = {
      logs: logs, // Keep as array for client-side filtering
      returnValue: hr?.returnCode,
      error: hr?.error,
      input: hr?.input,
      output: hr?.output,
      properties: hr?.properties,
    };
  }

  return {
    hookResults,
    finalResponse: result.finalResponse,
    calculatedProperties: result.calculatedProperties,
  };
}

export interface TestConfig {
  description?: string;
  wasm?: {
    path: string;
    description?: string;
  };
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
  properties: Record<string, string>;
  logLevel: number;
}

export async function loadConfig(): Promise<TestConfig> {
  const response = await fetch(`${API_BASE}/config`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "Failed to load config");
  }

  const result = await response.json();
  return result.config;
}

export async function saveConfig(config: TestConfig): Promise<void> {
  const response = await fetch(`${API_BASE}/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ config }),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "Failed to save config");
  }
}
