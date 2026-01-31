/**
 * WebSocket Status Indicator
 *
 * Displays current WebSocket connection status with visual feedback
 */

import type { WebSocketStatus } from "../hooks/useWebSocket";

export interface ConnectionStatusProps {
  status: WebSocketStatus;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const getStatusColor = (): string => {
    if (status.connected) return "#4caf50"; // Green
    if (status.reconnecting) return "#ff9800"; // Orange
    if (status.error) return "#f44336"; // Red
    return "#757575"; // Gray
  };

  const getStatusText = (): string => {
    if (status.connected) {
      return status.clientCount > 1
        ? `Connected (${status.clientCount} clients)`
        : "Connected";
    }
    if (status.reconnecting) return "Reconnecting...";
    if (status.error) return "Disconnected";
    return "Not connected";
  };

  return (
    <div className="connection-status">
      <div
        className="status-indicator"
        style={{ backgroundColor: getStatusColor() }}
        title={status.error || getStatusText()}
      />
      <span className="status-text">{getStatusText()}</span>
    </div>
  );
}
