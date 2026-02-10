import { ChangeEvent } from "react";
import styles from "./RequestBar.module.css";

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
    <div className={styles.requestBar}>
      <div className={styles.urlInputContainer}>
        <select
          value={method}
          onChange={handleMethodChange}
          className={styles.methodSelect}
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
          className={styles.urlInput}
        />
      </div>
      <button onClick={onSend} disabled={!wasmLoaded} className={styles.sendButton}>
        Send
      </button>
    </div>
  );
}
