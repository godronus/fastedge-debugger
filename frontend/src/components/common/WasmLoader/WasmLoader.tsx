import { ChangeEvent, useState, useEffect } from "react";
import styles from "./WasmLoader.module.css";
import { formatFileSize } from "../../../utils/filePath";

type LoaderTab = 'path' | 'upload';

interface WasmLoaderProps {
  onFileLoad: (file: File) => void;
  onPathLoad?: (path: string) => void;
  loading: boolean;
  // Loading metadata (optional)
  loadingMode?: 'path' | 'buffer' | null;
  loadTime?: number | null;
  fileSize?: number | null;
  fileName?: string | null;
  // Default tab based on environment
  defaultTab?: LoaderTab;
  // Current WASM path from global store (for syncing input field)
  wasmPath?: string | null;
}

export function WasmLoader({
  onFileLoad,
  onPathLoad,
  loading,
  loadingMode,
  loadTime,
  fileSize,
  fileName,
  defaultTab = 'upload',
  wasmPath: globalWasmPath,
}: WasmLoaderProps) {
  const [wasmPath, setWasmPath] = useState("");
  const [activeTab, setActiveTab] = useState<LoaderTab>(defaultTab);

  // Update active tab when defaultTab changes (environment detection completes)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Sync local input field with global store's wasmPath
  useEffect(() => {
    if (globalWasmPath && globalWasmPath !== wasmPath) {
      setWasmPath(globalWasmPath);
    }
  }, [globalWasmPath]);

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

  const handlePathKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      </div>

      {/* Tabs */}
      {onPathLoad && (
        <div className={styles.tabs}>
          <div className={styles.tabButtons}>
            <button
              className={`${styles.tab} ${activeTab === 'path' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('path')}
              disabled={loading}
            >
              <span className={styles.tabIcon}>📁</span>
              <span>File Path</span>
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'upload' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('upload')}
              disabled={loading}
            >
              <span className={styles.tabIcon}>📤</span>
              <span>Upload File</span>
            </button>
          </div>

          {/* Show loaded WASM info in tabs bar */}
          {!loading && fileName && loadingMode && (
            <div className={styles.tabInfo} title={getLoadingModeTitle()}>
              <span className={styles.tabInfoIcon}>{getLoadingModeIcon()}</span>
              <span className={styles.tabInfoText}>{getLoadingModeText()}</span>
              {loadTime !== null && loadTime !== undefined && (
                <span className={styles.tabInfoTime}>• {loadTime.toFixed(1)}ms</span>
              )}
              {fileSize && (
                <span className={styles.tabInfoSize}>• ({formatFileSize(fileSize)})</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {/* Path Tab */}
        {onPathLoad && activeTab === 'path' && (
          <div className={styles.pathPanel}>
            <div className={styles.panelDescription}>
              Load WASM directly from filesystem path (faster, no upload needed)
            </div>
            <div className={styles.pathInputGroup}>
              <input
                type="text"
                className={styles.pathInput}
                placeholder="<workspace>/.fastedge/bin/debugger.wasm"
                value={wasmPath}
                onChange={(e) => setWasmPath(e.target.value)}
                onKeyDown={handlePathKeyDown}
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

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className={styles.uploadPanel}>
            <div className={styles.panelDescription}>
              Upload a WASM binary file from your computer
            </div>
            <input
              type="file"
              accept=".wasm"
              onChange={handleFileChange}
              disabled={loading}
              className={styles.fileInput}
            />
          </div>
        )}
      </div>

      {loading && (
        <span className={styles.loadingIndicator}> Loading...</span>
      )}
    </section>
  );
}
