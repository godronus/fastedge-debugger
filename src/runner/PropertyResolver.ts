import type { HeaderMap } from "./types";

export class PropertyResolver {
  private properties: Record<string, unknown> = {};
  private requestHeaders: HeaderMap = {};
  private requestMethod = "GET";
  private requestPath = "/";
  private requestScheme = "https";
  private responseHeaders: HeaderMap = {};
  private responseStatus = 200;
  private responseStatusText = "OK";

  setProperties(properties: Record<string, unknown>): void {
    this.properties = properties;
  }

  setRequestMetadata(
    headers: HeaderMap,
    method: string,
    path: string,
    scheme: string,
  ): void {
    this.requestHeaders = headers;
    this.requestMethod = method;
    this.requestPath = path;
    this.requestScheme = scheme;
  }

  setResponseMetadata(
    headers: HeaderMap,
    status: number,
    statusText: string,
  ): void {
    this.responseHeaders = headers;
    this.responseStatus = status;
    this.responseStatusText = statusText;
  }

  resolve(path: string): unknown {
    // Check custom properties first
    if (Object.prototype.hasOwnProperty.call(this.properties, path)) {
      return this.properties[path];
    }

    // Check standard request/response properties
    const standardValue = this.resolveStandard(path);
    if (standardValue !== undefined) {
      return standardValue;
    }

    const derivedRootId = this.deriveRootId();
    if (derivedRootId) {
      const normalizedPath = path.replace(/\0/g, "/");
      if (
        normalizedPath === "root_id" ||
        normalizedPath === "plugin_name" ||
        normalizedPath === "plugin_root_id" ||
        normalizedPath === "root_context" ||
        normalizedPath === "root_context_id"
      ) {
        return derivedRootId;
      }
    }

    const segments = path.split("\0").filter((segment) => segment.length > 0);
    if (segments.length > 0) {
      const nested = this.resolvePathSegments(segments);
      if (nested !== undefined) {
        return nested;
      }
      const dotted = segments.join(".");
      if (Object.prototype.hasOwnProperty.call(this.properties, dotted)) {
        return this.properties[dotted];
      }
      const slashed = segments.join("/");
      if (Object.prototype.hasOwnProperty.call(this.properties, slashed)) {
        return this.properties[slashed];
      }
    }

    if (path.includes(".")) {
      const nested = this.resolvePathSegments(path.split("."));
      if (nested !== undefined) {
        return nested;
      }
    }

    return undefined;
  }

  private resolveStandard(path: string): unknown {
    // Normalize path separators (handle both \0 and .)
    const normalizedPath = path.replace(/\0/g, ".");

    // Request properties
    if (normalizedPath === "request.method") return this.requestMethod;
    if (normalizedPath === "request.path") return this.requestPath;
    if (normalizedPath === "request.url") {
      const host = this.requestHeaders["host"] || "localhost";
      return `${this.requestScheme}://${host}${this.requestPath}`;
    }
    if (normalizedPath === "request.host") {
      return this.requestHeaders["host"] || "localhost";
    }
    if (normalizedPath === "request.scheme") return this.requestScheme;
    if (normalizedPath === "request.protocol") return this.requestScheme;
    if (normalizedPath === "request.content_type") {
      return this.requestHeaders["content-type"] || "";
    }

    // Response properties
    if (normalizedPath === "response.code") return this.responseStatus;
    if (normalizedPath === "response.status") return this.responseStatus;
    if (normalizedPath === "response.status_code") return this.responseStatus;
    if (normalizedPath === "response.code_details") {
      return this.responseStatusText;
    }
    if (normalizedPath === "response.content_type") {
      return this.responseHeaders["content-type"] || "";
    }

    return undefined;
  }

  private resolvePathSegments(segments: string[]): unknown {
    let current: unknown = this.properties;
    for (const segment of segments) {
      if (segment.length === 0) {
        continue;
      }
      if (
        current &&
        typeof current === "object" &&
        segment in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private deriveRootId(): string | null {
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
      const value = this.resolve(key);
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
    return null;
  }
}
