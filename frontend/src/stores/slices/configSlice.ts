import { StateCreator } from 'zustand';
import { AppStore, ConfigSlice, ConfigState, TestConfig } from '../types';

const DEFAULT_CONFIG_STATE: ConfigState = {
  properties: {},
  dotenvEnabled: true,
  logLevel: 3,
  autoSave: true,
  lastSaved: null,
  isDirty: false,
};

export const createConfigSlice: StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  ConfigSlice
> = (set, get) => ({
  ...DEFAULT_CONFIG_STATE,

  setProperties: (properties) =>
    set((state) => {
      state.properties = properties;
      state.isDirty = true;
    }),

  updateProperty: (key, value) =>
    set((state) => {
      state.properties[key] = value;
      state.isDirty = true;
    }),

  removeProperty: (key) =>
    set((state) => {
      delete state.properties[key];
      state.isDirty = true;
    }),

  mergeProperties: (properties) =>
    set((state) => {
      Object.assign(state.properties, properties);
      state.isDirty = true;
    }),

  setDotenvEnabled: (enabled) =>
    set((state) => {
      state.dotenvEnabled = enabled;
      state.isDirty = true;
    }),

  setLogLevel: (level) =>
    set((state) => {
      state.logLevel = level;
      state.isDirty = true;
    }),

  setAutoSave: (enabled) =>
    set((state) => {
      state.autoSave = enabled;
    }),

  markDirty: () =>
    set((state) => {
      state.isDirty = true;
    }),

  markClean: () =>
    set((state) => {
      state.isDirty = false;
      state.lastSaved = Date.now();
    }),

  loadFromConfig: (config) =>
    set((state) => {
      // Populate state from TestConfig
      state.properties = { ...config.properties };
      state.logLevel = config.logLevel;
      state.dotenvEnabled = config.dotenvEnabled ?? true;

      // Mark as clean after loading
      state.isDirty = false;
      state.lastSaved = Date.now();
    }),

  exportConfig: () => {
    const state = get();
    const config: TestConfig = {
      request: {
        method: state.method,
        url: state.url,
        headers: { ...state.requestHeaders },
        body: state.requestBody,
      },
      response: {
        headers: { ...state.responseHeaders },
        body: state.responseBody,
      },
      properties: { ...state.properties },
      logLevel: state.logLevel,
      dotenvEnabled: state.dotenvEnabled,
    };

    // Include wasm path if loaded
    if (state.wasmPath) {
      config.wasm = {
        path: state.wasmPath,
        description: 'Current loaded WASM binary',
      };
    }

    return config;
  },

  resetConfig: () =>
    set((state) => {
      Object.assign(state, DEFAULT_CONFIG_STATE);
      state.isDirty = true;
    }),
});
