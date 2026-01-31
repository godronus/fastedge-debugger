/**
 * WebSocket Event Types
 *
 * Defines all events that can flow between server and clients
 */

export type EventSource = "ui" | "ai_agent" | "api" | "system";

/**
 * Base event structure
 */
export interface BaseEvent {
  type: string;
  timestamp: number;
  source: EventSource;
}

/**
 * WASM binary loaded
 */
export interface WasmLoadedEvent extends BaseEvent {
  type: "wasm_loaded";
  data: {
    filename: string;
    size: number;
  };
}

/**
 * Request execution started
 */
export interface RequestStartedEvent extends BaseEvent {
  type: "request_started";
  data: {
    url: string;
    method: string;
    headers: Record<string, string>;
  };
}

/**
 * Individual hook executed
 */
export interface HookExecutedEvent extends BaseEvent {
  type: "hook_executed";
  data: {
    hook: string;
    returnCode: number | null;
    logCount: number;
    input: {
      request: { headers: Record<string, string>; body: string };
      response: { headers: Record<string, string>; body: string };
    };
    output: {
      request: { headers: Record<string, string>; body: string };
      response: { headers: Record<string, string>; body: string };
    };
  };
}

/**
 * Request execution completed
 */
export interface RequestCompletedEvent extends BaseEvent {
  type: "request_completed";
  data: {
    hookResults: Record<string, any>;
    finalResponse: {
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      contentType: string;
      isBase64?: boolean;
    };
  };
}

/**
 * Request execution failed
 */
export interface RequestFailedEvent extends BaseEvent {
  type: "request_failed";
  data: {
    error: string;
    details?: string;
  };
}

/**
 * Properties updated
 */
export interface PropertiesUpdatedEvent extends BaseEvent {
  type: "properties_updated";
  data: {
    properties: Record<string, string>;
  };
}

/**
 * Connection status
 */
export interface ConnectionStatusEvent extends BaseEvent {
  type: "connection_status";
  data: {
    connected: boolean;
    clientCount: number;
  };
}

/**
 * Union of all possible events
 */
export type ServerEvent =
  | WasmLoadedEvent
  | RequestStartedEvent
  | HookExecutedEvent
  | RequestCompletedEvent
  | RequestFailedEvent
  | PropertiesUpdatedEvent
  | ConnectionStatusEvent;

/**
 * Helper to create events with automatic timestamp
 */
export function createEvent<T extends ServerEvent>(
  type: T["type"],
  source: EventSource,
  data: T["data"],
): T {
  return {
    type,
    timestamp: Date.now(),
    source,
    data,
  } as T;
}
