import express, { type Request, type Response } from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { WasmRunnerFactory } from "./runner/WasmRunnerFactory.js";
import type { IWasmRunner } from "./runner/IWasmRunner.js";
import { WebSocketManager, StateManager } from "./websocket/index.js";
import { detectWasmType } from "./utils/wasmTypeDetector.js";
import { validatePath } from "./utils/pathValidator.js";

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket infrastructure
const debug = process.env.PROXY_RUNNER_DEBUG === "1";
const wsManager = new WebSocketManager(httpServer, debug);
const stateManager = new StateManager(wsManager, debug);

// Initialize runner factory
const runnerFactory = new WasmRunnerFactory();
let currentRunner: IWasmRunner | null = null;

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "frontend")));

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/api/load", async (req: Request, res: Response) => {
  const {
    wasmBase64,
    wasmPath,
    dotenvEnabled = true,
  } = req.body ?? {};

  // Validate that at least one of wasmBase64 or wasmPath is provided
  if (!wasmBase64 && !wasmPath) {
    res.status(400).json({ error: "Missing wasmBase64 or wasmPath" });
    return;
  }

  if (wasmBase64 && wasmPath) {
    res.status(400).json({ error: "Provide either wasmBase64 or wasmPath, not both" });
    return;
  }

  try {
    let bufferOrPath: Buffer | string;
    let fileSize: number;
    let fileName: string;

    // Path-based loading (preferred for performance)
    if (wasmPath) {
      if (typeof wasmPath !== "string") {
        res.status(400).json({ error: "wasmPath must be a string" });
        return;
      }

      // Validate path for security
      const validationResult = validatePath(wasmPath, {
        requireWasmExtension: true,
        checkExists: true,
      });

      if (!validationResult.valid) {
        res.status(400).json({ error: validationResult.error });
        return;
      }

      // Use normalized path
      bufferOrPath = validationResult.normalizedPath!;
      fileName = path.basename(bufferOrPath);

      // Get file size for event emission
      const stats = await fs.stat(bufferOrPath);
      fileSize = stats.size;
    }
    // Buffer-based loading (fallback for web UI)
    else if (wasmBase64) {
      if (typeof wasmBase64 !== "string") {
        res.status(400).json({ error: "wasmBase64 must be a string" });
        return;
      }

      // Convert to buffer
      bufferOrPath = Buffer.from(wasmBase64, "base64");
      fileSize = bufferOrPath.length;
      fileName = "binary.wasm";
    } else {
      // This shouldn't happen due to validation above, but TypeScript needs it
      res.status(400).json({ error: "Missing wasmBase64 or wasmPath" });
      return;
    }

    // Auto-detect WASM type
    const wasmType = await detectWasmType(bufferOrPath);

    // Cleanup previous runner
    if (currentRunner) {
      await currentRunner.cleanup();
    }

    // Create appropriate runner based on detected type
    currentRunner = runnerFactory.createRunner(wasmType, dotenvEnabled);
    currentRunner.setStateManager(stateManager);

    // Load WASM (accepts either Buffer or string path)
    await currentRunner.load(bufferOrPath, { dotenvEnabled });

    // Emit WASM loaded event
    const source = (req.headers["x-source"] as any) || "ui";
    stateManager.emitWasmLoaded(fileName, fileSize, source);

    res.json({ ok: true, wasmType });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

app.post("/api/execute", async (req: Request, res: Response) => {
  const { url, method, headers, body } = req.body ?? {};

  if (!currentRunner) {
    res.status(400).json({ error: "No WASM module loaded. Call /api/load first." });
    return;
  }

  try {
    if (currentRunner.getType() === "http-wasm") {
      // HTTP WASM: Simple request/response
      if (!url || typeof url !== "string") {
        res.status(400).json({ error: "Missing url for HTTP WASM request" });
        return;
      }

      const urlObj = new URL(url);
      const result = await currentRunner.execute({
        path: urlObj.pathname + urlObj.search,
        method: method || "GET",
        headers: headers || {},
        body: body || "",
      });

      // Emit HTTP WASM request completed event
      const source = (req.headers["x-source"] as any) || "ui";
      stateManager.emitHttpWasmRequestCompleted(
        {
          status: result.status,
          statusText: result.statusText,
          headers: result.headers,
          body: result.body,
          contentType: result.contentType,
          isBase64: result.isBase64,
        },
        result.logs,
        source,
      );

      res.json({ ok: true, result });
    } else {
      // Proxy-wasm: Use existing callFullFlow
      if (!url || typeof url !== "string") {
        res.status(400).json({ error: "Missing url" });
        return;
      }

      const { request, response, properties } = req.body ?? {};

      const fullFlowResult = await currentRunner.callFullFlow(
        url,
        request?.method || "GET",
        request?.headers || {},
        request?.body || "",
        response?.headers || {},
        response?.body || "",
        response?.status || 200,
        response?.statusText || "OK",
        properties || {},
        true // enforceProductionPropertyRules
      );

      // Emit request completed event
      const source = (req.headers["x-source"] as any) || "ui";
      stateManager.emitRequestCompleted(
        fullFlowResult.hookResults,
        fullFlowResult.finalResponse,
        fullFlowResult.calculatedProperties,
        source,
      );

      res.json({ ok: true, ...fullFlowResult });
    }
  } catch (error) {
    // Emit request failed event
    const source = (req.headers["x-source"] as any) || "ui";
    stateManager.emitRequestFailed(
      "Request execution failed",
      String(error),
      source,
    );

    res.status(500).json({ ok: false, error: String(error) });
  }
});

app.post("/api/call", async (req: Request, res: Response) => {
  const { hook, request, response, properties, logLevel } = req.body ?? {};
  if (!hook || typeof hook !== "string") {
    res.status(400).json({ error: "Missing hook" });
    return;
  }

  if (!currentRunner) {
    res.status(400).json({ error: "No WASM module loaded. Call /api/load first." });
    return;
  }

  try {
    // Always capture all logs (trace level) - filtering happens client-side
    const result = await currentRunner.callHook({
      hook,
      request: request ?? { headers: {}, body: "" },
      response: response ?? { headers: {}, body: "" },
      properties: properties ?? {},
      logLevel: 0, // Always use Trace to capture all logs
    });

    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

app.post("/api/send", async (req: Request, res: Response) => {
  const { url, request, response, properties, logLevel } = req.body ?? {};
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url" });
    return;
  }

  if (!currentRunner) {
    res.status(400).json({ error: "No WASM module loaded. Call /api/load first." });
    return;
  }

  try {
    // Always capture all logs (trace level) - filtering happens client-side
    const fullFlowResult = await currentRunner.callFullFlow(
      url,
      request?.method || "GET",
      request?.headers || {},
      request?.body || "",
      response?.headers || {},
      response?.body || "",
      response?.status || 200,
      response?.statusText || "OK",
      properties || {},
      true // enforceProductionPropertyRules
    );

    // Emit request completed event
    const source = (req.headers["x-source"] as any) || "ui";
    stateManager.emitRequestCompleted(
      fullFlowResult.hookResults,
      fullFlowResult.finalResponse,
      fullFlowResult.calculatedProperties,
      source,
    );

    res.json({ ok: true, ...fullFlowResult });
  } catch (error) {
    // Emit request failed event
    const source = (req.headers["x-source"] as any) || "ui";
    stateManager.emitRequestFailed(
      "Request execution failed",
      String(error),
      source,
    );

    res.status(500).json({ ok: false, error: String(error) });
  }
});

// Get test configuration
app.get("/api/config", async (req: Request, res: Response) => {
  try {
    const configPath = path.join(__dirname, "..", "test-config.json");
    const configData = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configData);
    res.json({ ok: true, config });
  } catch (error) {
    res.status(404).json({ ok: false, error: "Config file not found" });
  }
});

// Save test configuration
app.post("/api/config", async (req: Request, res: Response) => {
  try {
    const { config } = req.body ?? {};
    if (!config) {
      res.status(400).json({ error: "Missing config" });
      return;
    }

    const configPath = path.join(__dirname, "..", "test-config.json");
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    // Emit properties updated event if properties changed
    if (config.properties) {
      const source = (req.headers["x-source"] as any) || "ui";
      stateManager.emitPropertiesUpdated(config.properties, source);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

const port = process.env.PORT ? Number(process.env.PORT) : 5179;
httpServer.listen(port, () => {
  console.log(`Proxy runner listening on http://localhost:${port}`);
  console.log(`WebSocket available at ws://localhost:${port}/ws`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing server...");
  if (currentRunner) {
    await currentRunner.cleanup();
  }
  wsManager.close();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing server...");
  if (currentRunner) {
    await currentRunner.cleanup();
  }
  wsManager.close();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
