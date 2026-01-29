import { ChangeEvent } from "react";

interface RequestBarProps {
  method: string;
  url: string;
  wasmLoaded: boolean;
  onMethodChange: (method: string) => void;
  onUrlChange: (url: string) => void;
  onSend: () => void;
}

const METHODS = ["GET", "POST"];

export function RequestBar({
  method,
  url,
  wasmLoaded,
  onMethodChange,
  onUrlChange,
  onSend,
}: RequestBarProps) {
  const handleMethodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onMethodChange(e.target.value);
  };

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUrlChange(e.target.value);
  };

  return (
    <div className="request-bar">
      <div className="url-input-container">
        <select
          value={method}
          onChange={handleMethodChange}
          className="method-select"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder="Enter request URL (e.g., https://example.com/api/endpoint)"
          className="url-input"
        />
      </div>
      <button onClick={onSend} disabled={!wasmLoaded} className="send-button">
        Send
      </button>
    </div>
  );
}
