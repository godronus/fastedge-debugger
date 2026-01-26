const wasmInput = document.getElementById("wasmFile");
const loadBtn = document.getElementById("loadBtn");
const loadStatus = document.getElementById("loadStatus");
const reqMethod = document.getElementById("reqMethod");
const reqPath = document.getElementById("reqPath");
const reqScheme = document.getElementById("reqScheme");
const reqHeaders = document.getElementById("reqHeaders");
const reqBody = document.getElementById("reqBody");
const resStatus = document.getElementById("resStatus");
const resStatusText = document.getElementById("resStatusText");
const resHeaders = document.getElementById("resHeaders");
const resBody = document.getElementById("resBody");
const properties = document.getElementById("properties");
const logLevel = document.getElementById("logLevel");
const output = document.getElementById("output");

loadBtn.addEventListener("click", async () => {
  if (!wasmInput.files || wasmInput.files.length === 0) {
    setStatus("Select a .wasm file first", true);
    return;
  }

  const file = wasmInput.files[0];
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  setStatus("Loading...", false);
  const response = await fetch("/api/load", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wasmBase64: base64 }),
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    setStatus(result.error || "Load failed", true);
    return;
  }

  setStatus("Loaded successfully", false);
});

document.getElementById("runAllBtn").addEventListener("click", async () => {
  const hooks = [
    "onRequestHeaders",
    "onRequestBody",
    "onResponseHeaders",
    "onResponseBody",
  ];

  const results = [];
  output.textContent = "Running full request flow...\n\n";

  for (const hook of hooks) {
    const payload = {
      hook,
      request: {
        method: reqMethod.value,
        path: reqPath.value,
        scheme: reqScheme.value,
        headers: parseJson(reqHeaders.value),
        body: reqBody.value,
      },
      response: {
        status: parseInt(resStatus.value, 10),
        statusText: resStatusText.value,
        headers: parseJson(resHeaders.value),
        body: resBody.value,
      },
      properties: parseJson(properties.value),
      logLevel: parseInt(logLevel.value, 10),
    };

    output.textContent += `\n═══ ${hook} ═══\n`;

    try {
      const response = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        output.textContent += `❌ Error: ${result.error || "Hook failed"}\n`;
        break;
      }

      results.push({ hook, result: result.result });

      // Show logs
      if (result.result.logs && result.result.logs.length > 0) {
        output.textContent += "Logs:\n";
        for (const log of result.result.logs) {
          const levels = [
            "trace",
            "debug",
            "info",
            "warn",
            "error",
            "critical",
          ];
          const levelName = levels[log.level] || `level${log.level}`;
          output.textContent += `  [${levelName}] ${log.message}\n`;
        }
      }

      // Show return code
      if (result.result.returnCode !== null) {
        output.textContent += `Return: ${result.result.returnCode}\n`;
      }
    } catch (error) {
      output.textContent += `❌ Exception: ${error}\n`;
      break;
    }
  }

  output.textContent += "\n✅ Request flow completed\n";
});

for (const button of document.querySelectorAll("[data-hook]")) {
  button.addEventListener("click", async () => {
    const hook = button.getAttribute("data-hook");
    if (!hook) return;

    const payload = {
      hook,
      request: {
        method: reqMethod.value,
        path: reqPath.value,
        scheme: reqScheme.value,
        headers: parseJson(reqHeaders.value),
        body: reqBody.value,
      },
      response: {
        status: parseInt(resStatus.value, 10),
        statusText: resStatusText.value,
        headers: parseJson(resHeaders.value),
        body: resBody.value,
      },
      properties: parseJson(properties.value),
      logLevel: parseInt(logLevel.value, 10),
    };

    output.textContent = "Running hook...";
    const response = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      output.textContent = result.error || "Hook failed";
      return;
    }

    output.textContent = JSON.stringify(result.result, null, 2);
  });
}

function setStatus(message, isError) {
  loadStatus.textContent = message;
  loadStatus.className = isError ? "status error" : "status";
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (error) {
    output.textContent = `Invalid JSON: ${error}`;
    throw error;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
