import express, { type Request, type Response } from "express";
import path from "node:path";
import { ProxyWasmRunner } from "./runner/ProxyWasmRunner";

const app = express();
const runner = new ProxyWasmRunner();

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "frontend")));

app.post("/api/load", async (req: Request, res: Response) => {
  const { wasmBase64 } = req.body ?? {};
  if (!wasmBase64 || typeof wasmBase64 !== "string") {
    res.status(400).json({ error: "Missing wasmBase64" });
    return;
  }

  try {
    const buffer = Buffer.from(wasmBase64, "base64");
    await runner.load(buffer);
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
    const result = await runner.callHook({
      hook,
      request: request ?? { headers: {}, body: "" },
      response: response ?? { headers: {}, body: "" },
      properties: properties ?? {},
      logLevel: logLevel !== undefined ? logLevel : 2, // Default to Info level
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
    const fullFlowResult = await runner.callFullFlow(
      {
        hook: "", // Not used in fullFlow
        request: request ?? { headers: {}, body: "", method: "GET" },
        response: response ?? { headers: {}, body: "" },
        properties: properties ?? {},
        logLevel: logLevel !== undefined ? logLevel : 2,
      },
      url,
    );

    res.json({ ok: true, ...fullFlowResult });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

const port = process.env.PORT ? Number(process.env.PORT) : 5179;
app.listen(port, () => {
  console.log(`Proxy runner listening on http://localhost:${port}`);
});
