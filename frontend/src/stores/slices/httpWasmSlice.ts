import { StateCreator } from 'zustand';
import { AppStore, HttpWasmSlice, HttpWasmState } from '../types';
import { executeHttpWasm } from '../../api';

// ============================================================================
// DEFAULT STATE
// ============================================================================

const DEFAULT_HTTP_WASM_STATE: HttpWasmState = {
  // Request state
  httpMethod: 'GET',
  httpUrl: 'http://example.com',
  httpRequestHeaders: {},
  httpRequestBody: '',

  // Response state
  httpResponse: null,

  // Logs
  httpLogs: [],

  // Execution state
  httpIsExecuting: false,
};

// ============================================================================
// SLICE CREATOR
// ============================================================================

export const createHttpWasmSlice: StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  HttpWasmSlice
> = (set, get) => ({
  // Initial state
  ...DEFAULT_HTTP_WASM_STATE,

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Set HTTP method
   */
  setHttpMethod: (method: string) => {
    set(
      (state) => {
        state.httpMethod = method;
      },
      false,
      'httpWasm/setMethod'
    );
  },

  /**
   * Set request URL
   */
  setHttpUrl: (url: string) => {
    set(
      (state) => {
        state.httpUrl = url;
      },
      false,
      'httpWasm/setUrl'
    );
  },

  /**
   * Set request headers
   */
  setHttpRequestHeaders: (headers: Record<string, string>) => {
    set(
      (state) => {
        state.httpRequestHeaders = headers;
      },
      false,
      'httpWasm/setRequestHeaders'
    );
  },

  /**
   * Set request body
   */
  setHttpRequestBody: (body: string) => {
    set(
      (state) => {
        state.httpRequestBody = body;
      },
      false,
      'httpWasm/setRequestBody'
    );
  },

  /**
   * Set response
   */
  setHttpResponse: (response: HttpWasmState['httpResponse']) => {
    set(
      (state) => {
        state.httpResponse = response;
      },
      false,
      'httpWasm/setResponse'
    );
  },

  /**
   * Set logs
   */
  setHttpLogs: (logs: Array<{ level: number; message: string }>) => {
    set(
      (state) => {
        state.httpLogs = logs;
      },
      false,
      'httpWasm/setLogs'
    );
  },

  /**
   * Set execution state
   */
  setHttpIsExecuting: (isExecuting: boolean) => {
    set(
      (state) => {
        state.httpIsExecuting = isExecuting;
      },
      false,
      'httpWasm/setIsExecuting'
    );
  },

  /**
   * Execute HTTP WASM request
   */
  executeHttpRequest: async () => {
    const state = get();

    // Set executing state
    set(
      (state) => {
        state.httpIsExecuting = true;
      },
      false,
      'httpWasm/executeRequest/start'
    );

    try {
      const result = await executeHttpWasm(
        state.httpUrl,
        state.httpMethod,
        state.httpRequestHeaders,
        state.httpRequestBody
      );

      // Update response and logs
      set(
        (state) => {
          state.httpResponse = {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers,
            body: result.body,
            contentType: result.contentType,
            isBase64: result.isBase64,
          };
          state.httpLogs = result.logs;
          state.httpIsExecuting = false;
        },
        false,
        'httpWasm/executeRequest/success'
      );
    } catch (err) {
      // Handle errors
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute HTTP WASM';

      set(
        (state) => {
          state.httpResponse = {
            status: 0,
            statusText: 'Error',
            headers: {},
            body: errorMessage,
            contentType: 'text/plain',
          };
          state.httpLogs = [
            { level: 4, message: `Error: ${errorMessage}` }
          ];
          state.httpIsExecuting = false;
        },
        false,
        'httpWasm/executeRequest/error'
      );
    }
  },

  /**
   * Clear response and logs
   */
  clearHttpResponse: () => {
    set(
      (state) => {
        state.httpResponse = null;
        state.httpLogs = [];
      },
      false,
      'httpWasm/clearResponse'
    );
  },

  /**
   * Reset all HTTP WASM state
   */
  resetHttpWasm: () => {
    set(
      (state) => {
        Object.assign(state, DEFAULT_HTTP_WASM_STATE);
      },
      false,
      'httpWasm/reset'
    );
  },
});
