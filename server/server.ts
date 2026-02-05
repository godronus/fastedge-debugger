import express, { type Request, type Response } from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { ProxyWasmRunner } from "./runner/ProxyWasmRunner.js";
import { WebSocketManager, StateManager } from "./websocket/index.js";

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket infrastructure
const debug = process.env.PROXY_RUNNER_DEBUG === "1";
const wsManager = new WebSocketManager(httpServer, debug);
const stateManager = new StateManager(wsManager, debug);

// Initialize runner with dotenv enabled by default
let runner = new ProxyWasmRunner(undefined, true);

// Make state manager available to runner
runner.setStateManager(stateManager);

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "frontend")));

app.post("/api/load", async (req: Request, res: Response) => {
  const { wasmBase64, dotenvEnabled = true } = req.body ?? {};
  if (!wasmBase64 || typeof wasmBase64 !== "string") {
    res.status(400).json({ error: "Missing wasmBase64" });
    return;
  }

  try {
    // Recreate runner with dotenvEnabled setting
    runner = new ProxyWasmRunner(undefined, dotenvEnabled);
    runner.setStateManager(stateManager);

    const buffer = Buffer.from(wasmBase64, "base64");
    await runner.load(buffer);

    // Emit WASM loaded event
    const source = (req.headers["x-source"] as any) || "ui";
    stateManager.emitWasmLoaded("binary.wasm", buffer.length, source);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

app.post("/api/call", async (req: Request, res: Response) => {
  const { hook, request, response, properties, logLevel } = req.body ?? {};
  if (!hook || typeof hook !== "string") {
    res.status(400).json({ error: "Missing hook" });
    return;
  }

  try {
    // Always capture all logs (trace level) - filtering happens client-side
    const result = await runner.callHook({
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

  try {
    // Always capture all logs (trace level) - filtering happens client-side
    const fullFlowResult = await runner.callFullFlow(
      {
        hook: "", // Not used in fullFlow
        request: request ?? { headers: {}, body: "", method: "GET" },
        response: response ?? { headers: {}, body: "" },
        properties: properties ?? {},
        logLevel: 0, // Always use Trace to capture all logs
      },
      url,
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
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  wsManager.close();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, closing server...");
  wsManager.close();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
