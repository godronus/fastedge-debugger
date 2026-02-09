/_
For Context this is code that has been compiled into the wasm binary we are trying to run.
_/

```assemblyscript
export * from "@gcoredev/proxy-wasm-sdk-as/assembly/proxy"; // this exports the required functions for the proxy to interact with us.
import {
  Context,
  FilterHeadersStatusValues,
  log,
  LogLevelValues,
  registerRootContext,
  RootContext,
} from "@gcoredev/proxy-wasm-sdk-as/assembly";
import {
  setLogLevel,
  getEnvVar,
  getSecretVar,
} from "@gcoredev/proxy-wasm-sdk-as/assembly/fastedge";

class HttpHostFunctionsRoot extends RootContext {
  createContext(context_id: u32): Context {
    setLogLevel(LogLevelValues.debug); // Set the log level to info - for more logging reduce this to LogLevelValues.debug
    return new HttpHostFunctions(context_id, this);
  }
}

class HttpHostFunctions extends Context {
  constructor(context_id: u32, root_context: HttpHostFunctionsRoot) {
    super(context_id, root_context);
  }

  onRequestHeaders(a: u32, end_of_stream: bool): FilterHeadersStatusValues {
    log(LogLevelValues.debug, "onRequestHeaders >> ");

    // Access environment variables using getEnv host function
    const apiUrl = getEnvVar("API_URL");
    log(LogLevelValues.info, "API_URL: " + apiUrl);

    const featureDashboard = getEnvVar("FEATURE_NEW_DASHBOARD");
    log(LogLevelValues.info, "FEATURE_NEW_DASHBOARD: " + featureDashboard);

    // Access secrets using getSecret host function
    const jwtSecret = getSecretVar("JWT_SECRET");
    log(LogLevelValues.info, "JWT_SECRET: " + jwtSecret);

    const apiKey = getSecretVar("API_KEY");
    log(LogLevelValues.info, "API_KEY: " + apiKey);

    return FilterHeadersStatusValues.Continue;
  }
}

registerRootContext((context_id: u32) => {
  return new HttpHostFunctionsRoot(context_id);
}, "httpHostFunctions");

```
