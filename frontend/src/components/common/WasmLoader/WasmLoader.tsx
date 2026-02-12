import { ChangeEvent, useState } from "react";
import styles from "./WasmLoader.module.css";
import { formatFileSize } from "../../../utils/filePath";

interface WasmLoaderProps {
  onFileLoad: (file: File) => void;
  onPathLoad?: (path: string) => void;
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
  onPathLoad,
  loading,
  onLoadConfig,
  onSaveConfig,
  loadingMode,
  loadTime,
  fileSize,
  fileName,
}: WasmLoaderProps) {
  const [wasmPath, setWasmPath] = useState("");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileLoad(file);
    }
  };

  const handlePathLoad = () => {
    if (wasmPath.trim() && onPathLoad) {
      onPathLoad(wasmPath.trim());
    }
  };

  const handlePathKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && wasmPath.trim() && onPathLoad) {
      handlePathLoad();
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

      {/* Option 1: Load from Path */}
      {onPathLoad && (
        <div className={styles.pathSection}>
          <div className={styles.optionHeader}>
            <span className={styles.optionLabel}>Option 1: File Path</span>
            <span className={styles.optionDesc}>(faster for local files)</span>
          </div>
          <div className={styles.pathInputGroup}>
            <input
              type="text"
              className={styles.pathInput}
              placeholder="/workspace/target/wasm32-wasi/release/app.wasm"
              value={wasmPath}
              onChange={(e) => setWasmPath(e.target.value)}
              onKeyPress={handlePathKeyPress}
              disabled={loading}
            />
            <button
              onClick={handlePathLoad}
              disabled={loading || !wasmPath.trim()}
              className={styles.pathButton}
            >
              Load from Path
            </button>
          </div>
        </div>
      )}

      {/* Option 2: Upload File */}
      <div className={styles.fileSection}>
        <div className={styles.optionHeader}>
          <span className={styles.optionLabel}>
            {onPathLoad ? 'Option 2: Upload File' : 'Load WASM File'}
          </span>
          {onPathLoad && (
            <span className={styles.optionDesc}>(works anywhere)</span>
          )}
        </div>
        <input
          type="file"
          accept=".wasm"
          onChange={handleFileChange}
          disabled={loading}
        />
      </div>

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
