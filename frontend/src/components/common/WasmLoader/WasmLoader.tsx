import { ChangeEvent } from "react";
import styles from "./WasmLoader.module.css";

interface WasmLoaderProps {
  onFileLoad: (file: File) => void;
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
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileLoad(file);
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
