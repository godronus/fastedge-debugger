export * from "@gcoredev/proxy-wasm-sdk-as/assembly/proxy"; // this exports the required functions for the proxy to interact with us.
import {
  BufferTypeValues,
  Context,
  FilterDataStatusValues,
  FilterHeadersStatusValues,
  get_buffer_bytes,
  log,
  LogLevelValues,
  registerRootContext,
  RootContext,
  set_buffer_bytes,
  stream_context,
} from "@gcoredev/proxy-wasm-sdk-as/assembly";
import { setLogLevel } from "@gcoredev/proxy-wasm-sdk-as/assembly/fastedge";

import { collectHeaders } from "as_utils/assembly/headers";

class HttpHeadersRoot extends RootContext {
  createContext(context_id: u32): Context {
    setLogLevel(LogLevelValues.debug); // Set the log level to info - for more logging reduce this to LogLevelValues.debug
    return new HttpHeaders(context_id, this);
  }
}

class HttpHeaders extends Context {
  constructor(context_id: u32, root_context: HttpHeadersRoot) {
    super(context_id, root_context);
  }

  onRequestHeaders(a: u32, end_of_stream: bool): FilterHeadersStatusValues {
    log(
      LogLevelValues.debug,
      'onRequestHeaders >> injecting header { "x-custom-me", "I am injected" }',
    );

    // Add custom header to the request
    stream_context.headers.request.add("x-custom-me", "I am injected");

    // Check if we need to modify the body (x-inject-body header exists and content-type is JSON)
    const injectHeader = stream_context.headers.request.get("x-inject-body");
    const contentType = stream_context.headers.request.get("content-type");
    const isJsonContent =
      contentType !== null && contentType.includes("application/json");

    if (injectHeader !== null && isJsonContent) {
      // Remove content-length header as we will modify the body
      stream_context.headers.request.remove("content-length");
      log(
        LogLevelValues.debug,
        "onRequestHeaders >> Removed content-length for body modification",
      );
    }

    return FilterHeadersStatusValues.Continue;
  }

  onRequestBody(
    body_buffer_length: usize,
    end_of_stream: bool,
  ): FilterDataStatusValues {
    log(LogLevelValues.debug, "onRequestBody >>" + end_of_stream.toString());

    if (!end_of_stream) {
      // Wait until the complete body is buffered
      return FilterDataStatusValues.StopIterationAndBuffer;
    }

    // Check for x-inject-body header directly (each hook runs in its own sandbox)
    const injectHeader = stream_context.headers.request.get("x-inject-body");

    // Check if Content-Type is application/json
    const contentType = stream_context.headers.request.get("content-type");
    const isJsonContent =
      contentType !== null && contentType.includes("application/json");

    // If we have a header to inject and content is JSON, modify the body
    if (injectHeader !== null && isJsonContent) {
      // Retrieve the body from the HttpRequestBody buffer
      const bodyBytes = get_buffer_bytes(
        BufferTypeValues.HttpRequestBody,
        0,
        <u32>body_buffer_length,
      );

      if (bodyBytes.byteLength > 0) {
        const bodyString = String.UTF8.decode(bodyBytes);
        log(
          LogLevelValues.debug,
          "onRequestBody >> Original body: " + bodyString,
        );

        // Manually inject the field into the JSON string
        // Since AssemblyScript doesn't have JSON.parse, we'll do string manipulation
        let modifiedBody = bodyString.trimEnd();

        // Remove trailing } if it exists and add our field
        if (modifiedBody.endsWith("}")) {
          modifiedBody = modifiedBody.slice(0, -1);
          // Check if we need a comma (if JSON object is not empty)
          if (modifiedBody.trimEnd().endsWith("{")) {
            modifiedBody += `"x-inject-body":"${injectHeader}"}`;
          } else {
            modifiedBody += `,"x-inject-body":"${injectHeader}"}`;
          }
        } else {
          // Fallback: just append to the body
          modifiedBody = bodyString + `{"x-inject-body":"${injectHeader}"}`;
        }

        log(
          LogLevelValues.debug,
          "onRequestBody >> Modified body: " + modifiedBody,
        );

        // Set the modified body
        set_buffer_bytes(
          BufferTypeValues.HttpRequestBody,
          0,
          <u32>body_buffer_length,
          String.UTF8.encode(modifiedBody),
        );

        log(
          LogLevelValues.debug,
          "onRequestBody >> Injected x-inject-body into request body",
        );
      }
    }

    return FilterDataStatusValues.Continue;
  }

  onResponseHeaders(a: u32, end_of_stream: bool): FilterHeadersStatusValues {
    log(LogLevelValues.debug, "onResponseHeaders >>");
    return FilterHeadersStatusValues.Continue;
  }

  onResponseBody(
    body_buffer_length: usize,
    end_of_stream: bool,
  ): FilterDataStatusValues {
    log(LogLevelValues.debug, "onResponseBody >>" + end_of_stream.toString());
    return FilterDataStatusValues.Continue;
  }

  onLog(): void {
    log(
      LogLevelValues.info,
      "onLog >> completed (contextId): " + this.context_id.toString(),
    );
  }
}

registerRootContext((context_id: u32) => {
  return new HttpHeadersRoot(context_id);
}, "httpheaders");
