import { ChangeEvent, useState } from "react";
import styles from "./WasmLoader.module.css";

interface WasmLoaderProps {
  onFileLoad: (file: File, wasmType: 'proxy-wasm' | 'http-wasm') => void;
  loading: boolean;
  onLoadConfig?: () => void;
  onSaveConfig?: () => void;
}

export function WasmLoader({
  onFileLoad,
  loading,
  onLoadConfig,
  onSaveConfig,
}: WasmLoaderProps) {
  const [wasmType, setWasmType] = useState<'proxy-wasm' | 'http-wasm'>('http-wasm');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileLoad(file, wasmType);
    }
  };

  return (
    <section className={styles.wasmLoader}>
      <div className={styles.header}>
        <h2>Load WASM Binary</h2>
        <div className={styles.actions}>
          {onLoadConfig && (
            <button onClick={onLoadConfig} className={styles.secondaryButton}>
              📥 Load Config
            </button>
          )}
          {onSaveConfig && (
            <button onClick={onSaveConfig} className={styles.secondaryButton}>
              💾 Save Config
            </button>
          )}
        </div>
      </div>

      <div className={styles.typeSelector}>
        <label className={styles.typeLabel}>WASM Type:</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="wasmType"
              value="http-wasm"
              checked={wasmType === 'http-wasm'}
              onChange={() => setWasmType('http-wasm')}
              disabled={loading}
            />
            <span>HTTP WASM</span>
            <span className={styles.description}>Simple HTTP request/response</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="wasmType"
              value="proxy-wasm"
              checked={wasmType === 'proxy-wasm'}
              onChange={() => setWasmType('proxy-wasm')}
              disabled={loading}
            />
            <span>Proxy-WASM</span>
            <span className={styles.description}>Hook-based execution with properties</span>
          </label>
        </div>
      </div>

      <input
        type="file"
        accept=".wasm"
        onChange={handleFileChange}
        disabled={loading}
      />
      {loading && (
        <span className={styles.loadingIndicator}> Loading...</span>
      )}
    </section>
  );
}
