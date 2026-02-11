/**
 * Base interface for WASM runners
 *
 * Defines the common contract for both ProxyWasmRunner and HttpWasmRunner
 */

import type { StateManager } from "../websocket/StateManager.js";
import type { HookCall, HookResult, FullFlowResult } from "./types.js";

export type WasmType = "http-wasm" | "proxy-wasm";

export interface RunnerConfig {
  dotenvEnabled?: boolean;
  enforceProductionPropertyRules?: boolean;
}

/**
 * HTTP Request type for HTTP WASM runner
 */
export interface HttpRequest {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * HTTP Response type for HTTP WASM runner
 */
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  contentType: string | null;
  isBase64?: boolean;
  logs: Array<{ level: number; message: string }>;
}

/**
 * Base interface that all WASM runners must implement
 */
export interface IWasmRunner {
  /**
   * Load WASM binary into the runner
   * @param bufferOrPath The WASM binary as a Buffer, or a file path string
   * @param config Optional configuration
   */
  load(bufferOrPath: Buffer | string, config?: RunnerConfig): Promise<void>;

  /**
   * Execute a request through the WASM module (HTTP WASM only)
   * @param request The HTTP request to execute
   * @returns The HTTP response
   */
  execute(request: HttpRequest): Promise<HttpResponse>;

  /**
   * Call a specific hook (Proxy-WASM only)
   * @param hookCall The hook call parameters
   * @returns The hook execution result
   */
  callHook(hookCall: HookCall): Promise<HookResult>;

  /**
   * Execute full request/response flow (Proxy-WASM only)
   * @param url Request URL
   * @param method HTTP method
   * @param headers Request headers
   * @param body Request body
   * @param responseHeaders Response headers
   * @param responseBody Response body
   * @param responseStatus Response status code
   * @param responseStatusText Response status text
   * @param properties Shared properties
   * @param enforceProductionPropertyRules Whether to enforce property access rules
   * @param logLevel Optional log level filter (0=trace, 1=debug, 2=info, 3=warn, 4=error) - defaults to 0 (trace) to capture all logs
   * @returns Full flow execution result
   */
  callFullFlow(
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
  ): Promise<FullFlowResult>;

  /**
   * Clean up resources (processes, temp files, etc.)
   */
  cleanup(): Promise<void>;

  /**
   * Get the type of WASM this runner handles
   */
  getType(): WasmType;

  /**
   * Set the state manager for event emission
   * @param stateManager The state manager instance
   */
  setStateManager(stateManager: StateManager): void;
}
