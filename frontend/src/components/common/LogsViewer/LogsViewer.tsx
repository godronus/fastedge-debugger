import { useState } from "react";
import styles from "./LogsViewer.module.css";

interface LogEntry {
  level: number;
  message: string;
}

interface LogsViewerProps {
  logs: LogEntry[];
  defaultLogLevel?: number;
  showLevelFilter?: boolean;
}

const LOG_LEVEL_NAMES = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];

const LOG_LEVEL_COLORS: Record<number, string> = {
  0: styles.trace,   // gray
  1: styles.debug,   // blue
  2: styles.info,    // green
  3: styles.warn,    // yellow
  4: styles.error,   // red
  5: styles.critical // red + bold
};

export function LogsViewer({
  logs,
  defaultLogLevel = 0,
  showLevelFilter = true
}: LogsViewerProps) {
  const [logLevel, setLogLevel] = useState<number>(defaultLogLevel);

  /**
   * Filter logs by selected log level
   * Only show logs with level >= selected level
   */
  const filterLogs = (logs: LogEntry[], minLevel: number): LogEntry[] => {
    return logs.filter((log) => log.level >= minLevel);
  };

  /**
   * Get log level name for display
   */
  const getLogLevelName = (level: number): string => {
    return LOG_LEVEL_NAMES[level] || "UNKNOWN";
  };

  const filteredLogs = filterLogs(logs, logLevel);
  const totalLogs = logs.length;
  const displayedLogs = filteredLogs.length;

  // Empty state
  if (totalLogs === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No logs captured</p>
      </div>
    );
  }

  return (
    <div className={styles.logsViewer}>
      {showLevelFilter && (
        <div className={styles.filterBar}>
          <label>Log Level:</label>
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(parseInt(e.target.value, 10))}
            className={styles.levelSelect}
          >
            <option value="0">Trace (0)</option>
            <option value="1">Debug (1)</option>
            <option value="2">Info (2)</option>
            <option value="3">Warn (3)</option>
            <option value="4">Error (4)</option>
            <option value="5">Critical (5)</option>
          </select>
          {displayedLogs < totalLogs && (
            <span className={styles.filterInfo}>
              Showing {displayedLogs} of {totalLogs} logs
            </span>
          )}
        </div>
      )}

      <pre className={styles.logsContainer}>
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, idx) => {
            const colorClass = LOG_LEVEL_COLORS[log.level] || styles.trace;
            return (
              <div key={idx} className={`${styles.logEntry} ${colorClass}`}>
                <span className={styles.logLevel}>
                  [{getLogLevelName(log.level)}]
                </span>
                <span className={styles.logMessage}>{log.message}</span>
              </div>
            );
          })
        ) : (
          <div className={styles.noLogs}>
            No logs at this level. Lower the log level to see more output.
          </div>
        )}
      </pre>
    </div>
  );
}
