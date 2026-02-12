import styles from './ConfigButtons.module.css';

interface ConfigButtonsProps {
  onLoadConfig: () => void;
  onSaveConfig: () => void;
  wasmType: 'proxy-wasm' | 'http-wasm' | null;
}

export function ConfigButtons({
  onLoadConfig,
  onSaveConfig,
  wasmType,
}: ConfigButtonsProps) {
  // Only show for proxy-wasm currently (http-wasm config support coming later)
  if (wasmType !== 'proxy-wasm') {
    return null;
  }

  return (
    <div className={styles.configButtons}>
      <button onClick={onLoadConfig} className="secondary">
        📥 Load Config
      </button>
      <button onClick={onSaveConfig} className="secondary">
        💾 Save Config
      </button>
    </div>
  );
}
