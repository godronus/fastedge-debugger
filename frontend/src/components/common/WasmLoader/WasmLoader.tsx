import { ChangeEvent } from "react";
import styles from "./WasmLoader.module.css";
import { formatFileSize } from "../../../utils/filePath";

interface WasmLoaderProps {
  onFileLoad: (file: File) => void;
  loading: boolean;
  onLoadConfig?: () => void;
  onSaveConfig?: () => void;
  // Loading metadata (optional)
  loadingMode?: 'path' | 'buffer' | null;
  loadTime?: number | null;
  fileSize?: number | null;
  fileName?: string | null;
}

export function WasmLoader({
  onFileLoad,
  loading,
  onLoadConfig,
  onSaveConfig,
  loadingMode,
  loadTime,
  fileSize,
  fileName,
}: WasmLoaderProps) {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileLoad(file);
    }
  };

  // Format loading mode for display
  const getLoadingModeIcon = () => {
    if (!loadingMode) return null;
    return loadingMode === 'path' ? '📁' : '💾';
  };

  const getLoadingModeText = () => {
    if (!loadingMode) return null;
    return loadingMode === 'path' ? 'Path-based' : 'Buffer-based';
  };

  const getLoadingModeTitle = () => {
    if (!loadingMode) return '';
    if (loadingMode === 'path') {
      return 'Optimized path-based loading (70-95% faster)';
    }
    return 'Standard buffer-based loading';
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

      {/* Show loaded WASM info */}
      {!loading && fileName && loadingMode && (
        <div className={styles.wasmInfo}>
          <div className={styles.wasmInfoRow}>
            <strong>Loaded:</strong> {fileName}
            {fileSize && <span> ({formatFileSize(fileSize)})</span>}
          </div>
          <div className={styles.wasmInfoRow} title={getLoadingModeTitle()}>
            <strong>Mode:</strong> {getLoadingModeIcon()} {getLoadingModeText()}
            {loadTime !== null && loadTime !== undefined && (
              <span> • {loadTime.toFixed(1)}ms</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
