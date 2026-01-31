/**
 * State Manager
 *
 * Coordinates state updates and event broadcasting
 * Single responsibility: Bridge between application logic and WebSocket broadcasting
 */

import { WebSocketManager } from "./WebSocketManager.js";
import {
  ServerEvent,
  EventSource,
  createEvent,
  WasmLoadedEvent,
  RequestStartedEvent,
  HookExecutedEvent,
  RequestCompletedEvent,
  RequestFailedEvent,
  PropertiesUpdatedEvent,
} from "./types.js";

export class StateManager {
  private wsManager: WebSocketManager;
  private debug: boolean;

  // Track current state for new connections
  private currentState: {
    wasmLoaded: string | null;
    wasmSize: number | null;
    properties: Record<string, string>;
    lastRequest: any;
  };

  constructor(wsManager: WebSocketManager, debug: boolean = false) {
    this.wsManager = wsManager;
    this.debug = debug;

    this.currentState = {
      wasmLoaded: null,
      wasmSize: null,
      properties: {},
      lastRequest: null,
    };
  }

  /**
   * Emit WASM loaded event
   */
  public emitWasmLoaded(
    filename: string,
    size: number,
    source: EventSource = "ui",
  ): void {
    this.currentState.wasmLoaded = filename;
    this.currentState.wasmSize = size;

    const event = createEvent<WasmLoadedEvent>("wasm_loaded", source, {
      filename,
      size,
    });

    this.broadcast(event);
  }

  /**
   * Emit request started event
   */
  public emitRequestStarted(
    url: string,
    method: string,
    headers: Record<string, string>,
    source: EventSource = "ui",
  ): void {
    this.currentState.lastRequest = { url, method, headers };

    const event = createEvent<RequestStartedEvent>("request_started", source, {
      url,
      method,
      headers,
    });

    this.broadcast(event);
  }

  /**
   * Emit individual hook executed event
   */
  public emitHookExecuted(
    hook: string,
    returnCode: number | null,
    logCount: number,
    input: {
      request: { headers: Record<string, string>; body: string };
      response: { headers: Record<string, string>; body: string };
    },
    output: {
      request: { headers: Record<string, string>; body: string };
      response: { headers: Record<string, string>; body: string };
    },
    source: EventSource = "system",
  ): void {
    const event = createEvent<HookExecutedEvent>("hook_executed", source, {
      hook,
      returnCode,
      logCount,
      input,
      output,
    });

    this.broadcast(event);
  }

  /**
   * Emit request completed event
   */
  public emitRequestCompleted(
    hookResults: Record<string, any>,
    finalResponse: {
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      contentType: string;
      isBase64?: boolean;
    },
    source: EventSource = "system",
  ): void {
    const event = createEvent<RequestCompletedEvent>(
      "request_completed",
      source,
      { hookResults, finalResponse },
    );

    this.broadcast(event);
  }

  /**
   * Emit request failed event
   */
  public emitRequestFailed(
    error: string,
    details?: string,
    source: EventSource = "system",
  ): void {
    const event = createEvent<RequestFailedEvent>("request_failed", source, {
      error,
      details,
    });

    this.broadcast(event);
  }

  /**
   * Emit properties updated event
   */
  public emitPropertiesUpdated(
    properties: Record<string, string>,
    source: EventSource = "ui",
  ): void {
    this.currentState.properties = properties;

    const event = createEvent<PropertiesUpdatedEvent>(
      "properties_updated",
      source,
      { properties },
    );

    this.broadcast(event);
  }

  /**
   * Get current state (for new connections)
   */
  public getCurrentState() {
    return { ...this.currentState };
  }

  /**
   * Broadcast event through WebSocket manager
   */
  private broadcast(event: ServerEvent): void {
    if (this.debug) {
      console.log(`[StateManager] Emitting ${event.type} from ${event.source}`);
    }

    this.wsManager.broadcast(event);
  }

  /**
   * Get connected client count
   */
  public getClientCount(): number {
    return this.wsManager.getClientCount();
  }
}
