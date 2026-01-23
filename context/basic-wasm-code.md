/*
For Context this is code that has been compiled into the wasm binary we are trying to run.
*/


export * from "@gcoredev/proxy-wasm-sdk-as/assembly/proxy"; // this exports the required functions for the proxy to interact with us.
import {
  Context,
  FilterDataStatusValues,
  FilterHeadersStatusValues,
  log,
  LogLevelValues,
  registerRootContext,
  RootContext,
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
    log(LogLevelValues.debug, "onRequestHeaders >> ");
    return FilterHeadersStatusValues.Continue;
  }

  onRequestBody(
    body_buffer_length: usize,
    end_of_stream: bool,
  ): FilterDataStatusValues {
    log(LogLevelValues.debug, "onRequestBody >>" + end_of_stream.toString());
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
