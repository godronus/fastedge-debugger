import { ChangeEvent } from "react";

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
    <section className="wasm-loader">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Load WASM Binary</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          {onLoadConfig && (
            <button onClick={onLoadConfig} className="secondary-button">
              📥 Load Config
            </button>
          )}
          {onSaveConfig && (
            <button onClick={onSaveConfig} className="secondary-button">
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
        <span style={{ marginLeft: "10px", color: "#ff6c37" }}>
          {" "}
          Loading...
        </span>
      )}
    </section>
  );
}
