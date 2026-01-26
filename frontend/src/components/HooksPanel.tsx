import { ChangeEvent } from "react";
import { HookCall } from "../types";
import { callHook } from "../api";

interface HooksPanelProps {
  wasmLoaded: boolean;
  hookCall: HookCall;
  logLevel: number;
  onLogLevelChange: (level: number) => void;
  onResult: (hook: string, result: any) => void;
}

const HOOKS = [
  "onRequestHeaders",
  "onRequestBody",
  "onResponseHeaders",
  "onResponseBody",
];

export function HooksPanel({
  wasmLoaded,
  hookCall,
  logLevel,
  onLogLevelChange,
  onResult,
}: HooksPanelProps) {
  const handleRunHook = async (hook: string) => {
    try {
      const result = await callHook(hook, { ...hookCall, logLevel });
      onResult(hook, result);
    } catch (err) {
      onResult(hook, {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleRunAll = async () => {
    for (const hook of HOOKS) {
      await handleRunHook(hook);
    }
  };

  const handleLogLevelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onLogLevelChange(parseInt(e.target.value, 10));
  };

  return (
    <section>
      <h2>5. Execute Hooks</h2>
      <div>
        <label>Log Level:</label>
        <select value={logLevel} onChange={handleLogLevelChange}>
          <option value="0">Trace (0)</option>
          <option value="1">Debug (1)</option>
          <option value="2">Info (2)</option>
          <option value="3">Warn (3)</option>
          <option value="4">Error (4)</option>
          <option value="5">Critical (5)</option>
        </select>
      </div>
      <button onClick={handleRunAll} disabled={!wasmLoaded}>
        Run All Hooks
      </button>
      <div className="hooks-grid">
        {HOOKS.map((hook) => (
          <button
            key={hook}
            onClick={() => handleRunHook(hook)}
            disabled={!wasmLoaded}
          >
            {hook}
          </button>
        ))}
      </div>
    </section>
  );
}
