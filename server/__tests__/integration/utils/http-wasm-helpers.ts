/**
 * Test helpers for HTTP WASM integration tests
 */

import { HttpWasmRunner } from '../../../runner/HttpWasmRunner';
import { PortManager } from '../../../runner/PortManager';
import type { IWasmRunner, HttpResponse } from '../../../runner/IWasmRunner';

/**
 * Shared PortManager instance for all HTTP WASM tests
 * This prevents port conflicts when running tests sequentially
 */
const sharedPortManager = new PortManager();

/**
 * Creates an HTTP WASM runner instance configured for integration testing
 *
 * @returns A configured HttpWasmRunner instance
 */
export function createHttpWasmRunner(): IWasmRunner {
  return new HttpWasmRunner(sharedPortManager, false); // Use shared port manager, disable dotenv
}

/**
 * Checks if an HTTP response was successful (2xx status code)
 *
 * @param response - The HTTP response to check
 * @returns True if the response has a 2xx status code
 */
export function isSuccessResponse(response: HttpResponse): boolean {
  return response.status >= 200 && response.status < 300;
}

/**
 * Checks if logs contain a specific message substring
 *
 * @param response - The HTTP response with logs
 * @param messageSubstring - The substring to search for
 * @returns True if any log contains the substring
 */
export function logsContain(response: HttpResponse, messageSubstring: string): boolean {
  return response.logs.some((log) => log.message.includes(messageSubstring));
}

/**
 * Extracts log messages at a specific level
 *
 * @param response - The HTTP response with logs
 * @param level - The log level (0=trace, 1=debug, 2=info, 3=warn, 4=error)
 * @returns Array of log messages at the specified level
 */
export function getLogsAtLevel(response: HttpResponse, level: number): string[] {
  return response.logs
    .filter((log) => log.level === level)
    .map((log) => log.message);
}

/**
 * Checks if response body is base64 encoded
 *
 * @param response - The HTTP response to check
 * @returns True if the body is base64 encoded
 */
export function isBase64Encoded(response: HttpResponse): boolean {
  return response.isBase64 === true;
}

/**
 * Checks if response content type matches expected type
 *
 * @param response - The HTTP response to check
 * @param expectedType - The expected content type (can be partial match)
 * @returns True if content type matches
 */
export function hasContentType(response: HttpResponse, expectedType: string): boolean {
  return response.contentType?.toLowerCase().includes(expectedType.toLowerCase()) ?? false;
}
