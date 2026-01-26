import { ChangeEvent } from "react";

interface WasmLoaderProps {
  onFileLoad: (file: File) => void;
  loading: boolean;
}

export function WasmLoader({ onFileLoad, loading }: WasmLoaderProps) {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileLoad(file);
    }
  };

  return (
    <section className="wasm-loader">
      <h2>Load WASM Binary</h2>
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
