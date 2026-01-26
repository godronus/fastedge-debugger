/_
For Context this is code that has been compiled into the wasm binary we are trying to run.
_/

export * from "@gcoredev/proxy-wasm-sdk-as/assembly/proxy"; // this exports the required functions for the proxy to interact with us.
import {
  BufferTypeValues,
  Context,
  FilterDataStatusValues,
  FilterHeadersStatusValues,
  get_buffer_bytes,
  get_property,
  log,
  LogLevelValues,
  registerRootContext,
  RootContext,
  send_http_response,
  set_property,
  stream_context,
} from "@gcoredev/proxy-wasm-sdk-as/assembly";
import { setLogLevel } from "@gcoredev/proxy-wasm-sdk-as/assembly/fastedge";

import { collectHeaders } from "as_utils/assembly/headers";

class HttpHeadersRoot extends RootContext {
  createContext(context_id: u32): Context {
    setLogLevel(LogLevelValues.trace); // Set the log level to info - for more logging reduce this to LogLevelValues.debug
    return new HttpHeaders(context_id, this);
  }
}

class HttpHeaders extends Context {
  constructor(context_id: u32, root_context: HttpHeadersRoot) {
    super(context_id, root_context);
  }

  onRequestHeaders(a: u32, end_of_stream: bool): FilterHeadersStatusValues {
    log(LogLevelValues.trace, "onRequestHeaders >> trace");
    log(LogLevelValues.debug, "onRequestHeaders >> debug");
    log(LogLevelValues.info, "onRequestHeaders >> info");
    log(LogLevelValues.warn, "onRequestHeaders >> warn");
    log(LogLevelValues.error, "onRequestHeaders >> error");
    log(LogLevelValues.critical, "onRequestHeaders >> critical");

    // Get the request headers
    const originalHeaders = collectHeaders(
      stream_context.headers.request.get_headers(),
    );

    if (originalHeaders.size === 0) {
      send_http_response(
        550,
        "internal server error",
        String.UTF8.encode("Internal server error"),
        [],
      );
      return FilterHeadersStatusValues.StopIteration;
    }

    // Check if the "host" header is present
    const hostHeader = stream_context.headers.request.get("host");
    if (hostHeader === null) {
      send_http_response(
        551,
        "internal server error",
        String.UTF8.encode("Internal server error"),
        [],
      );
      return FilterHeadersStatusValues.StopIteration;
    }

    // const hostArrBuf = get_property("request.host");
    // if (hostArrBuf.byteLength > 0) {
    //   const host = String.UTF8.decode(hostArrBuf);
    //   log(LogLevelValues.debug, `Provided Host: ${host}`);
    //   stream_context.headers.request.replace("Host", host);
    // }

    // const pathArrBuf = get_property("request.path");
    // if (pathArrBuf.byteLength === 0) {
    //   send_http_response(
    //     552,
    //     "internal server error",
    //     String.UTF8.encode("Internal server error - no request path"),
    //     []
    //   );
    //   return FilterHeadersStatusValues.StopIteration;
    // }

    // const path = String.UTF8.decode(pathArrBuf);
    // log(LogLevelValues.debug, `Provided Path: ${path}`);

    log(LogLevelValues.debug, `onRequestHeaders: OK!`);
    return FilterHeadersStatusValues.Continue;
  }

  onResponseHeaders(a: u32, end_of_stream: bool): FilterHeadersStatusValues {
    log(LogLevelValues.debug, "onResponseHeaders >>");

    // const contentType = stream_context.headers.response.get("content-type");
    // if (contentType.length > 0) {
    //   log(LogLevelValues.debug, "contentType=" + contentType + ">>>");
    //   set_property("response.content_type", String.UTF8.encode(contentType));
    // }

    return FilterHeadersStatusValues.Continue;
  }

  onResponseBody(
    body_buffer_length: usize,
    end_of_stream: bool,
  ): FilterDataStatusValues {
    log(LogLevelValues.debug, "onResponseBody >>" + end_of_stream.toString());

    // if (!end_of_stream) {
    //   // Wait until the complete body is buffered
    //   return FilterDataStatusValues.StopIterationAndBuffer;
    // }

    // log(
    //   LogLevelValues.debug,
    //   "onResponseBody >> body_buffer_length: " + body_buffer_length.toString()
    // );

    // // Retrieve the request URL
    // const urlBytes = get_property("request.url");
    // const url = urlBytes.byteLength === 0 ? "" : String.UTF8.decode(urlBytes);
    // if (url !== "") {
    //   log(LogLevelValues.info, `url=${url}`);
    // }

    // // Retrieve the request URL
    // const contentTypeBytes = get_property("request.content_type");
    // const contentType =
    //   contentTypeBytes.byteLength === 0
    //     ? ""
    //     : String.UTF8.decode(contentTypeBytes);
    // if (contentType !== "") {
    //   log(LogLevelValues.info, `contentType=${contentType}`);
    // }

    // // Retrieve the body from the HttpRequestBody buffer
    // const bodyBytes = get_buffer_bytes(
    //   BufferTypeValues.HttpResponseBody,
    //   0,
    //   <u32>body_buffer_length
    // );

    // if (bodyBytes.byteLength > 0) {
    //   const bodyStr = String.UTF8.decode(bodyBytes);
    //   log(LogLevelValues.info, "onHttpResponseBody >> bodyStr: " + bodyStr);
    // }
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
