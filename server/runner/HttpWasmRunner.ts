/**
 * HTTP WASM Runner
 *
 * Executes HTTP WASM binaries (component model with wasi-http interface)
 * using the FastEdge-run CLI as a process-based runner.
 */

import { spawn, ChildProcess } from "child_process";
import type {
  IWasmRunner,
  WasmType,
  RunnerConfig,
  HttpRequest,
  HttpResponse,
} from "./IWasmRunner.js";
import type { HookCall, HookResult, FullFlowResult } from "./types.js";
import type { StateManager } from "../websocket/StateManager.js";
import { PortManager } from "./PortManager.js";
import { findFastEdgeRunCli } from "../utils/fastedge-cli.js";
import {
  writeTempWasmFile,
  removeTempWasmFile,
} from "../utils/temp-file-manager.js";

/**
 * HttpWasmRunner implementation
 *
 * Spawns a long-running fastedge-run process and forwards HTTP requests to it
 */
export class HttpWasmRunner implements IWasmRunner {
  private process: ChildProcess | null = null;
  private port: number | null = null;
  private cliPath: string | null = null;
  private tempWasmPath: string | null = null;
  private logs: Array<{ level: number; message: string }> = [];
  private stateManager: StateManager | null = null;
  private portManager: PortManager;
  private dotenvEnabled: boolean = true;

  constructor(portManager: PortManager, dotenvEnabled: boolean = true) {
    this.portManager = portManager;
    this.dotenvEnabled = dotenvEnabled;
  }

  /**
   * Load WASM binary and spawn fastedge-run process
   */
  async load(bufferOrPath: Buffer | string, config?: RunnerConfig): Promise<void> {
    // Update config if provided
    if (config?.dotenvEnabled !== undefined) {
      this.dotenvEnabled = config.dotenvEnabled;
    }

    // Cleanup previous process if any
    await this.cleanup();

    // Find fastedge-run CLI
    this.cliPath = await findFastEdgeRunCli();

    // Determine WASM path
    let wasmPath: string;

    if (typeof bufferOrPath === "string") {
      // Path provided directly - use it without creating temp file
      wasmPath = bufferOrPath;
      this.tempWasmPath = null; // Don't cleanup this file (user-provided)
    } else {
      // Buffer provided - write to temp file (existing behavior)
      wasmPath = await writeTempWasmFile(bufferOrPath);
      this.tempWasmPath = wasmPath; // Cleanup this temp file later
    }

    // Allocate port (synchronous to avoid race conditions)
    this.port = this.portManager.allocate();

    // Build command arguments
    const args = [
      "http",
      "-p",
      this.port.toString(),
      "-w",
      wasmPath,
      "--wasi-http",
      "true",
    ];

    // Add dotenv flag if enabled
    if (this.dotenvEnabled) {
      args.push("--dotenv");
    }

    // Spawn process
    this.process = spawn(this.cliPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        RUST_LOG: "info",
        ...process.env,
      },
    });

    // Setup log capture
    this.setupLogCapture();

    // Setup error handlers
    this.setupErrorHandlers();

    // Wait for server to be ready (20 seconds in test environments, 5 seconds otherwise)
    // Increased timeout for slower-starting binaries (e.g., those with downstream fetches)
    const timeout = process.env.NODE_ENV === 'test' || process.env.VITEST ? 20000 : 5000;
    await this.waitForServerReady(this.port, timeout);
  }

  /**
   * Execute an HTTP request through the WASM module
   */
  async execute(request: HttpRequest): Promise<HttpResponse> {
    if (!this.port || !this.process) {
      throw new Error("HttpWasmRunner not loaded. Call load() first.");
    }

    // Clear previous logs
    this.logs = [];

    try {
      // Forward request to local fastedge-run server
      const url = `http://localhost:${this.port}${request.path}`;
      const response = await fetch(url, {
        method: request.method,
        headers: request.headers,
        body: request.body || undefined,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      // Read response body
      const arrayBuffer = await response.arrayBuffer();
      const bodyBuffer = Buffer.from(arrayBuffer);

      // Determine if response is binary
      const contentType = response.headers.get("content-type") || "";
      const isBinary = this.isBinaryContentType(contentType);

      // Convert body to string or base64
      const body = isBinary
        ? bodyBuffer.toString("base64")
        : bodyBuffer.toString("utf8");

      return {
        status: response.status,
        statusText: response.statusText,
        headers: this.parseHeaders(response.headers),
        body,
        contentType,
        isBase64: isBinary,
        logs: [...this.logs], // Copy logs
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logs.push({ level: 4, message: `Request failed: ${errorMessage}` });

      throw new Error(`HTTP request failed: ${errorMessage}`);
    }
  }

  /**
   * Not supported for HTTP WASM (proxy-wasm only)
   */
  async callHook(hookCall: HookCall): Promise<HookResult> {
    throw new Error(
      "callHook() is not supported for HTTP WASM. Use execute() instead."
    );
  }

  /**
   * Not supported for HTTP WASM (proxy-wasm only)
   */
  async callFullFlow(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string,
    responseHeaders: Record<string, string>,
    responseBody: string,
    responseStatus: number,
    responseStatusText: string,
    properties: Record<string, unknown>,
    enforceProductionPropertyRules: boolean,
    logLevel?: number
  ): Promise<FullFlowResult> {
    throw new Error(
      "callFullFlow() is not supported for HTTP WASM. Use execute() instead."
    );
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Kill process
    if (this.process) {
      await this.killProcess();
      this.process = null;
    }

    // Release port
    if (this.port !== null) {
      this.portManager.release(this.port);
      this.port = null;
    }

    // Remove temp file
    if (this.tempWasmPath) {
      await removeTempWasmFile(this.tempWasmPath);
      this.tempWasmPath = null;
    }

    // Clear logs
    this.logs = [];
  }

  /**
   * Get runner type
   */
  getType(): WasmType {
    return "http-wasm";
  }

  /**
   * Set state manager
   */
  setStateManager(stateManager: StateManager): void {
    this.stateManager = stateManager;
  }

  /**
   * Setup log capture from process stdout/stderr
   */
  private setupLogCapture(): void {
    if (!this.process) return;

    // Capture stdout as info logs
    this.process.stdout?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.logs.push({ level: 2, message }); // Info level
      }
    });

    // Capture stderr as error logs
    this.process.stderr?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.logs.push({ level: 4, message }); // Error level
      }
    });
  }

  /**
   * Setup error handlers for process
   */
  private setupErrorHandlers(): void {
    if (!this.process) return;

    this.process.on("error", (error) => {
      this.logs.push({
        level: 4,
        message: `Process error: ${error.message}`,
      });
    });

    this.process.on("exit", (code, signal) => {
      if (code !== null && code !== 0) {
        this.logs.push({
          level: 4,
          message: `Process exited with code ${code}`,
        });
      } else if (signal) {
        this.logs.push({
          level: 3,
          message: `Process killed with signal ${signal}`,
        });
      }
    });
  }

  /**
   * Wait for server to be ready by polling
   */
  private async waitForServerReady(
    port: number,
    timeoutMs: number
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`http://localhost:${port}/`, {
          signal: AbortSignal.timeout(1000),
        });
        // Any response means the server is up
        return;
      } catch (error) {
        // Server not ready yet, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    throw new Error(
      `FastEdge-run server did not start within ${timeoutMs}ms on port ${port}`
    );
  }

  /**
   * Kill the process gracefully (SIGINT) with fallback to SIGKILL
   * FastEdge-run responds to SIGINT for graceful shutdown
   */
  private async killProcess(): Promise<void> {
    if (!this.process) return;

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      // Try graceful shutdown first with SIGINT (FastEdge-run's preferred signal)
      this.process.kill("SIGINT");

      // Wait up to 2 seconds for graceful shutdown
      const timeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill("SIGKILL");
        }
        resolve();
      }, 2000);

      // Resolve immediately if process exits
      this.process.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Check if content type is binary
   */
  private isBinaryContentType(contentType: string): boolean {
    const binaryTypes = [
      "image/",
      "audio/",
      "video/",
      "application/octet-stream",
      "application/pdf",
      "application/zip",
      "application/gzip",
    ];

    return binaryTypes.some((type) =>
      contentType.toLowerCase().includes(type)
    );
  }

  /**
   * Parse headers from fetch Headers object
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}
