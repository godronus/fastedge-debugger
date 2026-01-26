import { ChangeEvent } from "react";

interface RequestBarProps {
  method: string;
  url: string;
  onMethodChange: (method: string) => void;
  onUrlChange: (url: string) => void;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function RequestBar({
  method,
  url,
  onMethodChange,
  onUrlChange,
}: RequestBarProps) {
  const handleMethodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onMethodChange(e.target.value);
  };

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUrlChange(e.target.value);
  };

  return (
    <div className="request-bar">
      <select value={method} onChange={handleMethodChange}>
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
      />
    </div>
  );
}
