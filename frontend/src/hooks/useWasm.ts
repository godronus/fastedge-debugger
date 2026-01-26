import { useState } from "react";
import { WasmState } from "../types";
import { uploadWasm } from "../api";

export function useWasm() {
  const [wasmState, setWasmState] = useState<WasmState>({
    wasmPath: null,
    wasmBuffer: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWasm = async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const path = await uploadWasm(file);

      setWasmState({
        wasmPath: path,
        wasmBuffer: buffer,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load WASM");
    } finally {
      setLoading(false);
    }
  };

  return { wasmState, loading, error, loadWasm };
}
