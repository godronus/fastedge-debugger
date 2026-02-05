/_
For Context this is code that has been compiled into the wasm binary we are trying to run.
_/

```assemblyscript
export * from "@gcoredev/proxy-wasm-sdk-as/assembly/proxy"; // this exports the required functions for the proxy to interact with us.
import {
  Context,
  FilterDataStatusValues,
  FilterHeadersStatusValues,
  get_property,
  log,
  LogLevelValues,
  registerRootContext,
  set_property,
  RootContext,
} from "@gcoredev/proxy-wasm-sdk-as/assembly";
import { setLogLevel } from "@gcoredev/proxy-wasm-sdk-as/assembly/fastedge";

class HttpPropertiesRoot extends RootContext {
  createContext(context_id: u32): Context {
    setLogLevel(LogLevelValues.debug); // Set the log level to info - for more logging reduce this to LogLevelValues.debug
    return new HttpProperties(context_id, this);
  }
}

class HttpProperties extends Context {
  constructor(context_id: u32, root_context: HttpPropertiesRoot) {
    super(context_id, root_context);
  }

  onRequestHeaders(a: u32, end_of_stream: bool): FilterHeadersStatusValues {
    log(LogLevelValues.debug, "onRequestHeaders >> ");

    const method = get_property("request.method");

    log(LogLevelValues.info, "Request Method: " + String.UTF8.decode(method));

    const path = get_property("request.path");

    log(LogLevelValues.info, "Request Path: " + String.UTF8.decode(path));

    set_property("request.path", String.UTF8.encode("/400"));

    const pathAltered = get_property("request.path");

    log(
      LogLevelValues.info,
      "Request Altered Path >> " + String.UTF8.decode(pathAltered),
    );

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

    const method = get_property("request.method");

    log(LogLevelValues.info, "Request Method: " + String.UTF8.decode(method));

    const path = get_property("request.path");

    log(LogLevelValues.info, "Request Path: " + String.UTF8.decode(path));
    return FilterDataStatusValues.Continue;
  }
}

registerRootContext((context_id: u32) => {
  return new HttpPropertiesRoot(context_id);
}, "httpProperties");

```
