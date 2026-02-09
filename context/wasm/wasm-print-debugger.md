/_
For Context this is code that has been compiled into the wasm binary we are trying to run.
_/

```assemblyscript
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
```

as_utils/assembly/headers:

```assemblyscript
import {
  Headers,
  log,
  LogLevelValues,
} from "@gcoredev/proxy-wasm-sdk-as/assembly";

function collectHeaders(
  headers: Headers,
  logHeaders: bool = true
): Set<string> {
  // Iterate over headers adding them to the returned set and log them if required
  const set = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const name = String.UTF8.decode(headers[i].key);
    const value = String.UTF8.decode(headers[i].value);
    if (logHeaders) log(LogLevelValues.info, `#header -> ${name}: ${value}`);
    set.add(`${name}:${value}`);
  }
  return set;
}

export { collectHeaders };
```
