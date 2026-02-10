import { StateCreator } from 'zustand';
import { AppStore, WasmSlice, WasmState } from '../types';
import { uploadWasm } from '../../api';

// ============================================================================
// DEFAULT STATE
// ============================================================================

const DEFAULT_WASM_STATE: WasmState = {
  wasmPath: null,
  wasmBuffer: null,
  wasmFile: null,
  wasmType: null,
  loading: false,
  error: null,
};

// ============================================================================
// SLICE CREATOR
// ============================================================================

export const createWasmSlice: StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  WasmSlice
> = (set, get) => ({
  // Initial state
  ...DEFAULT_WASM_STATE,

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Load a WASM file from disk
   * Reads the file as ArrayBuffer, uploads it to the server, and creates a blob URL
   */
  loadWasm: async (file: File, wasmType: 'proxy-wasm' | 'http-wasm', dotenvEnabled: boolean) => {
    // Set loading state
    set(
      (state) => {
        state.loading = true;
        state.error = null;
      },
      false,
      'wasm/loadWasm/start'
    );

    try {
      // Read file as ArrayBuffer
      const buffer = await file.arrayBuffer();

      // Upload to server and get path
      const path = await uploadWasm(file, wasmType, dotenvEnabled);

      // Update state with loaded WASM
      set(
        (state) => {
          state.wasmPath = path;
          state.wasmBuffer = buffer;
          state.wasmFile = file; // Store file for reload capability
          state.wasmType = wasmType;
          state.loading = false;
          state.error = null;
        },
        false,
        'wasm/loadWasm/success'
      );
    } catch (err) {
      // Handle errors
      const errorMessage = err instanceof Error ? err.message : 'Failed to load WASM';
      set(
        (state) => {
          state.error = errorMessage;
          state.loading = false;
        },
        false,
        'wasm/loadWasm/error'
      );
    }
  },

  /**
   * Reload the currently loaded WASM file
   * Useful when .env changes or server needs to reload
   */
  reloadWasm: async (dotenvEnabled: boolean) => {
    const { wasmFile, wasmType, loadWasm } = get();

    // Check if there's a file to reload
    if (!wasmFile || !wasmType) {
      set(
        (state) => {
          state.error = 'No WASM file loaded to reload';
        },
        false,
        'wasm/reloadWasm/error'
      );
      return;
    }

    // Reuse loadWasm logic
    await loadWasm(wasmFile, wasmType, dotenvEnabled);
  },

  /**
   * Clear all WASM state
   * Used when user wants to unload WASM or on error recovery
   */
  clearWasm: () => {
    set(
      (state) => {
        state.wasmPath = null;
        state.wasmBuffer = null;
        state.wasmFile = null;
        state.wasmType = null;
        state.loading = false;
        state.error = null;
      },
      false,
      'wasm/clearWasm'
    );
  },

  /**
   * Manually set loading state
   * Useful for external loading indicators
   */
  setLoading: (loading: boolean) => {
    set(
      (state) => {
        state.loading = loading;
      },
      false,
      'wasm/setLoading'
    );
  },

  /**
   * Manually set error state
   * Useful for external error handling
   */
  setError: (error: string | null) => {
    set(
      (state) => {
        state.error = error;
      },
      false,
      'wasm/setError'
    );
  },
});
