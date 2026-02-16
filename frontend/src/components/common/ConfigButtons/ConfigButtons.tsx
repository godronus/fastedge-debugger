import { useState } from 'react';
import { useAppStore } from '../../../stores';
import { ConfigEditorModal } from '../../ConfigEditorModal';
import type { TestConfig } from '../../../api';
import styles from './ConfigButtons.module.css';

export function ConfigButtons() {
  const { loadFromConfig, exportConfig, loadWasm, dotenvEnabled } = useAppStore();
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [configEditorInitial, setConfigEditorInitial] = useState<TestConfig | null>(null);

  const handleLoadConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      try {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const text = await file.text();
        const config = JSON.parse(text);

        // Basic validation
        if (!config.request || !config.properties || config.logLevel === undefined) {
          throw new Error('Invalid config file structure');
        }

        // Load config state
        loadFromConfig(config);

        // Auto-load WASM if path is specified
        if (config.wasm?.path) {
          try {
            await loadWasm(config.wasm.path, dotenvEnabled);
            alert(`✅ Configuration loaded from ${file.name}\n🚀 WASM auto-loaded: ${config.wasm.path}`);
          } catch (wasmError) {
            const wasmMsg = wasmError instanceof Error ? wasmError.message : 'Unknown error';
            alert(`✅ Configuration loaded from ${file.name}\n⚠️ Failed to auto-load WASM: ${wasmMsg}`);
          }
        } else {
          alert(`✅ Configuration loaded from ${file.name}!`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        alert(`❌ Failed to load config: ${msg}`);
      }
    };

    input.click();
  };

  const handleSaveConfig = () => {
    const config = exportConfig();
    setConfigEditorInitial(config);
    setShowConfigEditor(true);
  };

  return (
    <>
      <div className={styles.configButtons}>
        <button onClick={handleLoadConfig} className="secondary">
          📥 Load Config
        </button>
        <button onClick={handleSaveConfig} className="secondary">
          💾 Save Config
        </button>
      </div>

      {/* Config Editor Modal */}
      {showConfigEditor && configEditorInitial && (
        <ConfigEditorModal
          initialConfig={configEditorInitial}
          onClose={() => setShowConfigEditor(false)}
        />
      )}
    </>
  );
}
