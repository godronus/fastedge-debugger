import type { HeaderMap, LogEntry } from "./types";
import { ProxyStatus, BufferType, MapType } from "./types";
import { MemoryManager } from "./MemoryManager";
import { HeaderManager } from "./HeaderManager";
import { PropertyResolver } from "./PropertyResolver";

const textEncoder = new TextEncoder();

// Log levels from G-Core SDK
export enum LogLevel {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
  Critical = 5,
}

export class HostFunctions {
  private memory: MemoryManager;
  private propertyResolver: PropertyResolver;
  private logs: LogEntry[] = [];
  private requestHeaders: HeaderMap = {};
  private responseHeaders: HeaderMap = {};
  private requestBody = "";
  private responseBody = "";
  private vmConfig = "";
  private pluginConfig = "";
  private currentContextId = 1;
  private lastHostCall: string | null = null;
  private debug = false;
  private currentLogLevel: number = LogLevel.Trace; // Default to show all logs

  constructor(
    memory: MemoryManager,
    propertyResolver: PropertyResolver,
    debug = false,
  ) {
    this.memory = memory;
    this.propertyResolver = propertyResolver;
    this.debug = debug;
  }

  setLogs(logs: LogEntry[]): void {
    this.logs = logs;
  }

  setHeadersAndBodies(
    reqHeaders: HeaderMap,
    resHeaders: HeaderMap,
    reqBody: string,
    resBody: string,
  ): void {
    this.requestHeaders = reqHeaders;
    this.responseHeaders = resHeaders;
    this.requestBody = reqBody;
    this.responseBody = resBody;
  }

  setConfigs(vmConfig: string, pluginConfig: string): void {
    this.vmConfig = vmConfig;
    this.pluginConfig = pluginConfig;
  }

  setCurrentContext(contextId: number): void {
    this.currentContextId = contextId;
  }

  getCurrentLogLevel(): number {
    return this.currentLogLevel;
  }

  setLogLevel(level: number): void {
    this.currentLogLevel = level;
  }

  shouldLog(level: number): boolean {
    return level >= this.currentLogLevel;
  }

  getRequestHeaders(): HeaderMap {
    return this.requestHeaders;
  }

  getResponseHeaders(): HeaderMap {
    return this.responseHeaders;
  }

  getRequestBody(): string {
    return this.requestBody;
  }

  getResponseBody(): string {
    return this.responseBody;
  }

  createImports(): Record<string, WebAssembly.ImportValue> {
    return {
      proxy_log: (level: number, ptr: number, len: number) => {
        this.setLastHostCall(`proxy_log level=${level} len=${len}`);
        const message = this.memory.readString(ptr, len);
        // Only log if level meets or exceeds current log level
        if (level >= this.currentLogLevel) {
          this.logs.push({ level, message });
        }
        return ProxyStatus.Ok;
      },

      proxy_get_log_level: (levelPtr: number) => {
        this.setLastHostCall(`proxy_get_log_level`);
        if (levelPtr) {
          this.memory.writeU32(levelPtr, this.currentLogLevel);
        }
        return ProxyStatus.Ok;
      },

      proxy_set_log_level: (level: number) => {
        this.setLastHostCall(`proxy_set_log_level level=${level}`);
        this.currentLogLevel = level;
        this.logDebug(`Log level set to ${level}`);
        return ProxyStatus.Ok;
      },

      proxy_get_property: (
        pathPtr: number,
        pathLen: number,
        valuePtrPtr: number,
        valueLenPtr: number,
      ) => {
        this.setLastHostCall(`proxy_get_property pathLen=${pathLen}`);
        const path = this.memory.readString(pathPtr, pathLen);
        const raw = this.propertyResolver.resolve(path);
        if (raw === undefined) {
          this.logDebug(`get_property miss: ${path}`);
          this.memory.writeStringResult("", valuePtrPtr, valueLenPtr);
          return ProxyStatus.Ok;
        }
        const value = typeof raw === "string" ? raw : JSON.stringify(raw);
        this.memory.writeStringResult(value ?? "", valuePtrPtr, valueLenPtr);
        return ProxyStatus.Ok;
      },

      proxy_set_property: (
        pathPtr: number,
        pathLen: number,
        valuePtr: number,
        valueLen: number,
      ) => {
        this.setLastHostCall(
          `proxy_set_property pathLen=${pathLen} valueLen=${valueLen}`,
        );
        const path = this.memory.readString(pathPtr, pathLen);
        const value = this.memory.readString(valuePtr, valueLen);
        // Update via property resolver would require exposing setter
        // For now, log it
        this.logDebug(`set_property: ${path} = ${value}`);
        return ProxyStatus.Ok;
      },

      proxy_get_header_map_value: (
        mapType: number,
        keyPtr: number,
        keyLen: number,
        valuePtrPtr: number,
        valueLenPtr: number,
      ) => {
        this.setLastHostCall(
          `proxy_get_header_map_value map=${mapType} keyLen=${keyLen}`,
        );
        const key = this.memory.readString(keyPtr, keyLen).toLowerCase();
        const map = this.getHeaderMap(mapType);
        const value = map[key];
        if (value === undefined) {
          this.logDebug(`get_header_map_value miss: map=${mapType} key=${key}`);
          this.memory.writeStringResult("", valuePtrPtr, valueLenPtr);
          return ProxyStatus.Ok;
        }
        this.memory.writeStringResult(value, valuePtrPtr, valueLenPtr);
        return ProxyStatus.Ok;
      },

      proxy_get_header_map_pairs: (
        mapType: number,
        valuePtrPtr: number,
        valueLenPtr: number,
      ) => {
        this.setLastHostCall(`proxy_get_header_map_pairs map=${mapType}`);
        const map = this.getHeaderMap(mapType);
        const bytes = HeaderManager.serialize(map);
        const ptr = this.memory.writeToWasm(bytes);
        if (valuePtrPtr) {
          this.memory.writeU32(valuePtrPtr, ptr);
        }
        if (valueLenPtr) {
          this.memory.writeU32(valueLenPtr, bytes.length);
        }

        // Debug: Show the hex dump of first 64 bytes
        const hexDump = Array.from(bytes.slice(0, 64))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ");
        this.logDebug(
          `header_map_pairs ptr=${ptr} len=${bytes.length} count=${Object.keys(map).length} hex=${hexDump}`,
        );
        return ProxyStatus.Ok;
      },

      proxy_get_header_map_size: (mapType: number, sizePtr: number) => {
        this.setLastHostCall(`proxy_get_header_map_size map=${mapType}`);
        const map = this.getHeaderMap(mapType);
        // Return number of header pairs
        const size = Object.keys(map).length;
        this.memory.writeU32(sizePtr, size);
        this.logDebug(
          `header_map_size map=${mapType} size=${size} (pair count)`,
        );
        return ProxyStatus.Ok;
      },

      proxy_add_header_map_value: (
        mapType: number,
        keyPtr: number,
        keyLen: number,
        valuePtr: number,
        valueLen: number,
      ) => {
        this.setLastHostCall(
          `proxy_add_header_map_value map=${mapType} keyLen=${keyLen} valueLen=${valueLen}`,
        );
        const key = this.memory.readString(keyPtr, keyLen).toLowerCase();
        const value = this.memory.readString(valuePtr, valueLen);
        const map = this.getHeaderMap(mapType);
        const existing = map[key];
        map[key] = existing ? `${existing},${value}` : value;
        this.setHeaderMap(mapType, map);
        return ProxyStatus.Ok;
      },

      proxy_replace_header_map_value: (
        mapType: number,
        keyPtr: number,
        keyLen: number,
        valuePtr: number,
        valueLen: number,
      ) => {
        this.setLastHostCall(
          `proxy_replace_header_map_value map=${mapType} keyLen=${keyLen} valueLen=${valueLen}`,
        );
        const key = this.memory.readString(keyPtr, keyLen).toLowerCase();
        const value = this.memory.readString(valuePtr, valueLen);
        const map = this.getHeaderMap(mapType);
        map[key] = value;
        this.setHeaderMap(mapType, map);
        return ProxyStatus.Ok;
      },

      proxy_remove_header_map_value: (
        mapType: number,
        keyPtr: number,
        keyLen: number,
      ) => {
        this.setLastHostCall(
          `proxy_remove_header_map_value map=${mapType} keyLen=${keyLen}`,
        );
        const key = this.memory.readString(keyPtr, keyLen).toLowerCase();
        const map = this.getHeaderMap(mapType);
        delete map[key];
        this.setHeaderMap(mapType, map);
        return ProxyStatus.Ok;
      },

      proxy_set_header_map_pairs: (
        mapType: number,
        valuePtr: number,
        valueLen: number,
      ) => {
        this.setLastHostCall(
          `proxy_set_header_map_pairs map=${mapType} valueLen=${valueLen}`,
        );
        const raw = this.memory.readString(valuePtr, valueLen);
        const map = HeaderManager.deserialize(raw);
        this.setHeaderMap(mapType, map);
        return ProxyStatus.Ok;
      },

      proxy_get_buffer_bytes: (
        bufferType: number,
        start: number,
        length: number,
        valuePtrPtr: number,
        valueLenPtr: number,
      ) => {
        this.setLastHostCall(
          `proxy_get_buffer_bytes type=${bufferType} start=${start} length=${length}`,
        );
        const body = this.getBody(bufferType);
        const bytes = textEncoder.encode(body);
        const slice = bytes.slice(
          start,
          length > 0 ? start + length : undefined,
        );
        if (slice.length === 0) {
          this.logDebug(
            `get_buffer_bytes empty: type=${bufferType} start=${start} length=${length}`,
          );
        }
        this.memory.writeBytesResult(slice, valuePtrPtr, valueLenPtr);
        return ProxyStatus.Ok;
      },

      proxy_get_buffer_status: (
        bufferType: number,
        lengthPtr: number,
        flagsPtr: number,
      ) => {
        this.setLastHostCall(`proxy_get_buffer_status type=${bufferType}`);
        const body = this.getBody(bufferType);
        const length = byteLength(body);
        this.memory.writeU32(lengthPtr, length);
        this.memory.writeU32(flagsPtr, 1); // end_of_stream = true
        return ProxyStatus.Ok;
      },

      proxy_set_buffer_bytes: (
        bufferType: number,
        start: number,
        length: number,
        dataPtr: number,
        dataLen: number,
      ) => {
        this.setLastHostCall(
          `proxy_set_buffer_bytes type=${bufferType} start=${start} length=${length} dataLen=${dataLen}`,
        );
        const body = this.getBody(bufferType);
        const bytes = textEncoder.encode(body);
        const insert = this.memory.readBytes(dataPtr, dataLen);
        const prefix = bytes.slice(0, start);
        const suffix = bytes.slice(start + length);
        const next = new Uint8Array(
          prefix.length + insert.length + suffix.length,
        );
        next.set(prefix, 0);
        next.set(insert, prefix.length);
        next.set(suffix, prefix.length + insert.length);
        const updated = new TextDecoder().decode(next);
        this.setBody(bufferType, updated);
        return ProxyStatus.Ok;
      },

      proxy_set_effective_context: (contextId: number) => {
        this.setLastHostCall(`proxy_set_effective_context ${contextId}`);
        this.currentContextId = contextId || this.currentContextId;
        return ProxyStatus.Ok;
      },

      proxy_send_local_response: (
        statusCode: number,
        statusCodePtr: number,
        statusCodeLen: number,
        bodyPtr: number,
        bodyLen: number,
        grpcStatus: number,
      ) => {
        this.setLastHostCall(
          `proxy_send_local_response status=${statusCode} bodyLen=${bodyLen}`,
        );
        const statusText = this.memory.readString(statusCodePtr, statusCodeLen);
        const body = this.memory.readString(bodyPtr, bodyLen);
        this.logs.push({
          level: 1,
          message: `local_response status=${statusCode} ${statusText} body=${body} grpc=${grpcStatus}`,
        });
        return ProxyStatus.Ok;
      },

      abort: (
        messagePtr: number,
        filePtr: number,
        line: number,
        column: number,
      ) => {
        const message = this.memory.readOptionalString(messagePtr);
        const file = this.memory.readOptionalString(filePtr);
        const detail = `WASM abort: ${message ?? "<null>"} at ${file ?? "<unknown>"}:${line}:${column} lastHostCall=${this.lastHostCall ?? "<none>"}`;
        this.logs.push({ level: 3, message: detail });
        throw new Error(detail);
      },

      trace: (messagePtr: number, _nArgs: number, ..._args: number[]) => {
        const message = this.memory.readOptionalString(messagePtr) ?? "<trace>";
        this.logs.push({ level: 0, message: `trace: ${message}` });
      },
    };
  }

  private getHeaderMap(mapType: number): HeaderMap {
    if (
      mapType === MapType.ResponseHeaders ||
      mapType === MapType.ResponseTrailers
    ) {
      return this.responseHeaders;
    }
    return this.requestHeaders;
  }

  private setHeaderMap(mapType: number, map: HeaderMap): void {
    if (
      mapType === MapType.ResponseHeaders ||
      mapType === MapType.ResponseTrailers
    ) {
      this.responseHeaders = HeaderManager.normalize(map);
    } else {
      this.requestHeaders = HeaderManager.normalize(map);
    }
  }

  private getBody(bufferType: number): string {
    if (bufferType === BufferType.ResponseBody) {
      return this.responseBody;
    }
    if (bufferType === BufferType.VmConfiguration) {
      return this.vmConfig;
    }
    if (bufferType === BufferType.PluginConfiguration) {
      return this.pluginConfig;
    }
    return this.requestBody;
  }

  private setBody(bufferType: number, value: string): void {
    if (bufferType === BufferType.ResponseBody) {
      this.responseBody = value;
    } else if (bufferType === BufferType.VmConfiguration) {
      this.vmConfig = value;
    } else if (bufferType === BufferType.PluginConfiguration) {
      this.pluginConfig = value;
    } else {
      this.requestBody = value;
    }
  }

  private logDebug(message: string): void {
    if (!this.debug) {
      return;
    }
    const entry = { level: 0, message: `debug: ${message}` };
    this.logs.push(entry);
    console.warn(entry.message);
  }

  private setLastHostCall(message: string): void {
    this.lastHostCall = message;
    this.logDebug(`host_call ${message}`);
  }
}

function byteLength(value: string): number {
  return textEncoder.encode(value).length;
}
