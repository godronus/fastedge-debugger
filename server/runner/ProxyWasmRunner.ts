import { WASI } from "node:wasi";
import type { HookCall, HookResult, HeaderMap, FullFlowResult } from "./types";
import { MemoryManager } from "./MemoryManager";
import { HeaderManager } from "./HeaderManager";
import { PropertyResolver } from "./PropertyResolver";
import { HostFunctions } from "./HostFunctions";

const textEncoder = new TextEncoder();

export class ProxyWasmRunner {
  private instance: WebAssembly.Instance | null = null;
  private memory: MemoryManager;
  private propertyResolver: PropertyResolver;
  private hostFunctions: HostFunctions;
  private logs: { level: number; message: string }[] = [];
  private rootContextId = 1;
  private nextContextId = 2;
  private currentContextId = 1;
  private initialized = false;
  private debug = process.env.PROXY_RUNNER_DEBUG === "1";

  constructor() {
    this.memory = new MemoryManager();
    this.propertyResolver = new PropertyResolver();
    this.hostFunctions = new HostFunctions(
      this.memory,
      this.propertyResolver,
      this.debug,
    );

    // Set up memory manager to log to our logs array
    this.memory.setLogCallback((level: number, message: string) => {
      this.logs.push({ level, message });
    });
  }

  async load(buffer: Buffer): Promise<void> {
    this.resetState();

    const module = await WebAssembly.compile(new Uint8Array(buffer));
    if (this.debug) {
      const imports = WebAssembly.Module.imports(module);
      const exports = WebAssembly.Module.exports(module);
      console.warn(
        `debug: wasm imports=${imports.map((imp) => `${imp.module}.${imp.name}`).join(", ")}`,
      );
      console.warn(
        `debug: wasm exports=${exports.map((exp) => exp.name).join(", ")}`,
      );
    }

    const imports = this.createImports();
    const instance = await WebAssembly.instantiate(module, imports);
    this.instance = instance;

    const memory = instance.exports.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
      throw new Error("WASM module must export memory");
    }
    this.memory.setMemory(memory);
    this.memory.setInstance(instance);

    const wasiModule = imports.wasi_snapshot_preview1 as {
      initialize?: (instance: WebAssembly.Instance) => void;
    };
    if (wasiModule.initialize) {
      try {
        wasiModule.initialize(instance);
      } catch {
        // Some modules don't use WASI; ignore if initialization fails.
      }
    }

    const startFn = instance.exports._start;
    if (typeof startFn === "function") {
      try {
        this.logDebug("calling _start for runtime init");
        startFn();
      } catch (error) {
        this.logDebug(`_start failed: ${String(error)}`);
      }
    }

    this.initialized = false;
  }

  async callFullFlow(
    call: HookCall,
    targetUrl: string,
  ): Promise<FullFlowResult> {
    if (!this.instance) {
      throw new Error("WASM module not loaded");
    }

    const results: Record<string, HookResult> = {};

    // Phase 1: Run request hooks
    results.onRequestHeaders = await this.callHook({
      ...call,
      hook: "onRequestHeaders",
    });

    // Pass modified headers from onRequestHeaders to onRequestBody
    const headersAfterRequestHeaders =
      results.onRequestHeaders.output.request.headers;
    this.logDebug(
      `Headers after onRequestHeaders: ${JSON.stringify(headersAfterRequestHeaders)}`,
    );

    results.onRequestBody = await this.callHook({
      ...call,
      request: {
        ...call.request,
        headers: headersAfterRequestHeaders,
      },
      hook: "onRequestBody",
    });

    // Get modified request data from hooks
    const modifiedRequestHeaders = results.onRequestBody.output.request.headers;
    const modifiedRequestBody = results.onRequestBody.output.request.body;
    this.logDebug(
      `Final headers for fetch: ${JSON.stringify(modifiedRequestHeaders)}`,
    );
    const requestMethod = call.request.method ?? "GET";

    // Phase 2: Perform actual HTTP fetch
    try {
      this.logDebug(`Fetching ${requestMethod} ${targetUrl}`);

      // Preserve the host header as x-forwarded-host since fetch() will override it
      const fetchHeaders: Record<string, string> = {
        ...modifiedRequestHeaders,
      };

      // If there's a host header, also add it as x-forwarded-host
      const hostHeader = Object.entries(modifiedRequestHeaders).find(
        ([key]) => key.toLowerCase() === "host",
      );

      if (hostHeader) {
        fetchHeaders["x-forwarded-host"] = hostHeader[1];
        this.logDebug(`Adding x-forwarded-host: ${hostHeader[1]}`);
      }

      const fetchOptions: RequestInit = {
        method: requestMethod,
        headers: fetchHeaders,
      };

      // Add body for methods that support it
      if (
        ["POST", "PUT", "PATCH"].includes(requestMethod.toUpperCase()) &&
        modifiedRequestBody
      ) {
        fetchOptions.body = modifiedRequestBody;
      }

      const response = await fetch(targetUrl, fetchOptions);

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const contentType = response.headers.get("content-type") || "text/plain";
      const responseStatus = response.status;
      const responseStatusText = response.statusText;

      // Check if response is binary (image, video, audio, etc.)
      const isBinary =
        contentType.startsWith("image/") ||
        contentType.startsWith("video/") ||
        contentType.startsWith("audio/") ||
        contentType.includes("application/octet-stream") ||
        contentType.includes("application/pdf") ||
        contentType.includes("application/zip");

      let responseBody: string;
      let isBase64 = false;

      if (isBinary) {
        // For binary content, convert to base64
        const arrayBuffer = await response.arrayBuffer();
        responseBody = Buffer.from(arrayBuffer).toString("base64");
        isBase64 = true;
        this.logDebug(
          `Binary response converted to base64 (${arrayBuffer.byteLength} bytes)`,
        );
      } else {
        // For text content, just get as text
        responseBody = await response.text();
      }

      this.logDebug(`Fetch completed: ${responseStatus} ${responseStatusText}`);

      // Phase 3: Run response hooks with real response data
      // Use modified request headers from Phase 1, not original
      const responseCall = {
        ...call,
        request: {
          ...call.request,
          headers: modifiedRequestHeaders,
          body: modifiedRequestBody,
        },
        response: {
          headers: responseHeaders,
          body: responseBody,
          status: responseStatus,
          statusText: responseStatusText,
        },
      };

      results.onResponseHeaders = await this.callHook({
        ...responseCall,
        hook: "onResponseHeaders",
      });

      // Pass modified headers from onResponseHeaders to onResponseBody
      const headersAfterResponseHeaders =
        results.onResponseHeaders.output.response.headers;
      this.logDebug(
        `Headers after onResponseHeaders: ${JSON.stringify(headersAfterResponseHeaders)}`,
      );

      results.onResponseBody = await this.callHook({
        ...responseCall,
        response: {
          ...responseCall.response,
          headers: headersAfterResponseHeaders,
        },
        hook: "onResponseBody",
      });

      // Get final response after WASM modifications
      const finalHeaders = results.onResponseBody.output.response.headers;
      const finalBody = results.onResponseBody.output.response.body;
      this.logDebug(`Final response body length: ${finalBody.length}`);

      return {
        hookResults: results,
        finalResponse: {
          status: responseStatus,
          statusText: responseStatusText,
          headers: finalHeaders,
          body: finalBody,
          contentType,
          isBase64,
        },
      };
    } catch (error) {
      // Extract detailed error information
      let errorMessage = "Fetch failed";
      let errorDetails = "";

      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.cause) {
          errorDetails = ` (cause: ${String(error.cause)})`;
        }
      } else {
        errorMessage = String(error);
      }

      const fullErrorMessage = `Failed to fetch ${requestMethod} ${targetUrl}: ${errorMessage}${errorDetails}`;
      this.logDebug(fullErrorMessage);

      // Get the last successful request state
      const lastRequestState = results.onRequestBody?.output?.request || {
        headers: modifiedRequestHeaders,
        body: modifiedRequestBody,
      };

      // Return error in response hooks
      const errorResult: HookResult = {
        returnCode: null,
        logs: [{ level: 4, message: fullErrorMessage }],
        input: {
          request: lastRequestState,
          response: { headers: {}, body: "" },
        },
        output: {
          request: lastRequestState,
          response: { headers: {}, body: "" },
        },
        properties: call.properties,
      };
      results.onResponseHeaders = errorResult;
      results.onResponseBody = errorResult;

      return {
        hookResults: results,
        finalResponse: {
          status: 0,
          statusText: "Fetch Failed",
          headers: {},
          body: fullErrorMessage,
          contentType: "text/plain",
        },
      };
    }
  }

  async callHook(call: HookCall): Promise<HookResult> {
    if (!this.instance) {
      throw new Error("WASM module not loaded");
    }

    this.logs = [];

    // Set log level if specified (default to Info=2 if not specified)
    const logLevel = call.logLevel !== undefined ? call.logLevel : 2;
    this.hostFunctions.setLogLevel(logLevel);

    const requestHeaders = HeaderManager.normalize(call.request.headers ?? {});
    const responseHeaders = HeaderManager.normalize(
      call.response.headers ?? {},
    );
    const requestBody = call.request.body ?? "";
    const responseBody = call.response.body ?? "";
    const requestMethod = call.request.method ?? "GET";
    const requestPath = call.request.path ?? "/";
    const requestScheme = call.request.scheme ?? "https";
    const responseStatus = call.response.status ?? 200;
    const responseStatusText = call.response.statusText ?? "OK";

    this.propertyResolver.setProperties({ ...(call.properties ?? {}) });
    this.propertyResolver.setRequestMetadata(
      requestHeaders,
      requestMethod,
      requestPath,
      requestScheme,
    );
    this.propertyResolver.setResponseMetadata(
      responseHeaders,
      responseStatus,
      responseStatusText,
    );

    let vmConfig = normalizeConfigValue(
      call.properties["vm_config"] ?? call.properties["vmConfig"],
    );
    let pluginConfig = normalizeConfigValue(
      call.properties["plugin_config"] ?? call.properties["pluginConfig"],
    );

    const rootId = this.deriveRootId(call.properties);
    if (!vmConfig || vmConfig.trim() === "{}") {
      if (rootId) {
        vmConfig = JSON.stringify({ root_id: rootId });
        this.logDebug(`vm_config defaulted to JSON root_id: ${rootId}`);
      } else {
        vmConfig = "";
        this.logDebug("vm_config defaulted to empty");
      }
    }
    if (!pluginConfig || pluginConfig.trim() === "{}") {
      pluginConfig = "";
      this.logDebug("plugin_config defaulted to empty");
    }
    vmConfig = ensureNullTerminated(vmConfig);
    pluginConfig = ensureNullTerminated(pluginConfig);

    this.hostFunctions.setLogs(this.logs);
    this.hostFunctions.setHeadersAndBodies(
      requestHeaders,
      responseHeaders,
      requestBody,
      responseBody,
    );
    this.hostFunctions.setConfigs(vmConfig, pluginConfig);

    this.ensureInitialized(vmConfig, pluginConfig);

    const streamContextId = this.nextContextId++;
    this.currentContextId = streamContextId;
    this.hostFunctions.setCurrentContext(streamContextId);
    this.callIfExported(
      "proxy_on_context_create",
      streamContextId,
      this.rootContextId,
    );

    // Capture input state before hook execution
    const inputState = {
      request: {
        headers: { ...requestHeaders },
        body: requestBody,
      },
      response: {
        headers: { ...responseHeaders },
        body: responseBody,
      },
    };

    const { exportName, args } = this.buildHookInvocation(
      call.hook,
      requestHeaders,
      responseHeaders,
      requestBody,
      responseBody,
    );
    const returnCode = this.callIfExported(exportName, ...args);

    // Capture output state after hook execution
    const outputState = {
      request: {
        headers: { ...this.hostFunctions.getRequestHeaders() },
        body: this.hostFunctions.getRequestBody(),
      },
      response: {
        headers: { ...this.hostFunctions.getResponseHeaders() },
        body: this.hostFunctions.getResponseBody(),
      },
    };

    // Filter logs based on log level
    const filteredLogs = this.logs.filter((log) =>
      this.hostFunctions.shouldLog(log.level),
    );

    return {
      returnCode,
      logs: filteredLogs,
      input: inputState,
      output: outputState,
      properties: { ...call.properties },
    };
  }

  private resetState(): void {
    this.logs = [];
    this.rootContextId = 1;
    this.nextContextId = 2;
    this.currentContextId = 1;
    this.initialized = false;
    this.memory.reset();
  }

  private ensureInitialized(vmConfig: string, pluginConfig: string): void {
    if (this.initialized) {
      return;
    }
    const vmConfigSize = byteLength(vmConfig);
    this.logDebug(
      `vm_config bytes=${vmConfigSize} value=${vmConfig.replace(/\0/g, "\\0")}`,
    );
    try {
      this.callIfExported(
        "proxy_on_vm_start",
        this.rootContextId,
        vmConfigSize,
      );
    } catch (error) {
      this.logDebug(`proxy_on_vm_start failed: ${String(error)}`);
    }
    try {
      this.callIfExported(
        "proxy_on_plugin_start",
        this.rootContextId,
        byteLength(pluginConfig),
      );
    } catch (error) {
      this.logDebug(`proxy_on_plugin_start failed: ${String(error)}`);
    }
    const pluginConfigSize = byteLength(pluginConfig);
    this.logDebug(
      `plugin_config bytes=${pluginConfigSize} value=${pluginConfig.replace(/\0/g, "\\0")}`,
    );
    try {
      this.callIfExported(
        "proxy_on_configure",
        this.rootContextId,
        pluginConfigSize,
      );
    } catch (error) {
      this.logDebug(`proxy_on_configure failed: ${String(error)}`);
    }
    try {
      this.callIfExported("proxy_on_context_create", this.rootContextId, 0);
    } catch (error) {
      this.logDebug(`proxy_on_context_create failed: ${String(error)}`);
    }
    this.initialized = true;
  }

  private buildHookInvocation(
    hook: string,
    requestHeaders: HeaderMap,
    responseHeaders: HeaderMap,
    requestBody: string,
    responseBody: string,
  ): {
    exportName: string;
    args: number[];
  } {
    switch (hook) {
      case "onRequestHeaders":
        return {
          exportName: "proxy_on_request_headers",
          args: [this.currentContextId, Object.keys(requestHeaders).length, 0],
        };
      case "onRequestBody":
        return {
          exportName: "proxy_on_request_body",
          args: [this.currentContextId, byteLength(requestBody), 1],
        };
      case "onResponseHeaders":
        return {
          exportName: "proxy_on_response_headers",
          args: [this.currentContextId, Object.keys(responseHeaders).length, 0],
        };
      case "onResponseBody":
        return {
          exportName: "proxy_on_response_body",
          args: [this.currentContextId, byteLength(responseBody), 1],
        };
      default:
        throw new Error(`Unsupported hook: ${hook}`);
    }
  }

  private callIfExported(name: string, ...args: number[]): number | null {
    if (!this.instance) {
      return null;
    }

    const exported = this.instance.exports[name];
    if (typeof exported !== "function") {
      return null;
    }

    try {
      return exported(...args) as number;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logDebug(`trap in ${name}(${args.join(",")}): ${message}`);
      throw error;
    }
  }

  private createImports(): WebAssembly.Imports {
    const wasi = new WASI({ version: "preview1" });
    const wasiImport = wasi.wasiImport as Record<string, unknown>;

    return {
      env: this.hostFunctions.createImports(),
      wasi_snapshot_preview1: {
        ...wasiImport,
        initialize: wasi.initialize.bind(wasi),
        fd_write: (
          fd: number,
          iovs: number,
          iovsLen: number,
          nwritten: number,
        ) => {
          const captured = this.memory.captureFdWrite(
            fd,
            iovs,
            iovsLen,
            nwritten,
          );
          const original = wasiImport.fd_write as
            | ((
                fd: number,
                iovs: number,
                iovsLen: number,
                nwritten: number,
              ) => number)
            | undefined;
          if (typeof original === "function") {
            try {
              return original(fd, iovs, iovsLen, nwritten);
            } catch (error) {
              this.logDebug(`wasi fd_write failed: ${String(error)}`);
            }
          }
          if (nwritten) {
            this.memory.writeU32(nwritten, captured);
          }
          return 0;
        },
        proc_exit: (exitCode: number) => {
          this.logs.push({
            level: 2,
            message: `WASI proc_exit(${exitCode}) intercepted`,
          });
          return 0;
        },
      },
    };
  }

  private deriveRootId(properties: Record<string, unknown>): string | null {
    const candidates = [
      "root_id",
      "rootId",
      "root_context",
      "rootContext",
      "root_context_name",
      "rootContextName",
      "plugin_name",
      "pluginName",
      "context_name",
      "contextName",
    ];
    for (const key of candidates) {
      const value = properties[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
    return null;
  }

  private logDebug(message: string): void {
    if (!this.debug) {
      return;
    }
    const entry = { level: 0, message: `debug: ${message}` };
    this.logs.push(entry);
    console.warn(entry.message);
  }
}

function byteLength(value: string): number {
  return textEncoder.encode(value).length;
}

function normalizeConfigValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function ensureNullTerminated(value: string): string {
  if (!value) {
    return "";
  }
  return value.endsWith("\0") ? value : `${value}\0`;
}
