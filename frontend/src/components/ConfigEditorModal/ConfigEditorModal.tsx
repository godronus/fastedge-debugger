import { useState, useEffect } from "react";
import { TestConfig, saveConfigAs, showSaveDialog } from "../../api";
import { JsonEditorTab } from "./JsonEditorTab";
import styles from "./ConfigEditorModal.module.css";

interface ConfigEditorModalProps {
  initialConfig: TestConfig;
  onClose: () => void;
}

type TabType = "json" | "form";

export function ConfigEditorModal({
  initialConfig,
  onClose,
}: ConfigEditorModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("json");
  const [editedConfig, setEditedConfig] = useState<TestConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Generate suggested filename from WASM name
      const wasmName = editedConfig.wasm?.path
        ? editedConfig.wasm.path.split("/").pop()?.replace(".wasm", "")
        : null;
      const suggestedName = wasmName
        ? `${wasmName}-config.json`
        : "test-config.json";

      // Strategy 1: Try File System Access API (modern browsers)
      const hasFileSystemAPI = "showSaveFilePicker" in window;
      console.log("[ConfigEditor] File System Access API available:", hasFileSystemAPI);
      console.log("[ConfigEditor] Browser:", navigator.userAgent);

      if (hasFileSystemAPI) {
        try {
          console.log("[ConfigEditor] Attempting to show save dialog...");
          const handle = await (window as any).showSaveFilePicker({
            suggestedName,
            types: [
              {
                description: "JSON Config File",
                accept: { "application/json": [".json"] },
              },
            ],
          });

          console.log("[ConfigEditor] Dialog closed, handle:", handle);
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(editedConfig, null, 2));
          await writable.close();

          alert(`✅ Config saved to: ${handle.name}`);
          onClose();
          return;
        } catch (error: any) {
          console.error("[ConfigEditor] File System Access API error:", error);
          if (error.name === "AbortError") {
            // User cancelled
            setIsSaving(false);
            return;
          }
          console.warn("File System Access API failed, trying next strategy");
          // Fall through to next strategy
        }
      } else {
        console.log("[ConfigEditor] File System Access API not available, skipping");
      }

      // Strategy 2: Try backend Electron dialog (VS Code embedded mode)
      try {
        const dialogResult = await showSaveDialog(suggestedName);

        if (dialogResult.canceled) {
          setIsSaving(false);
          return;
        }

        if (dialogResult.filePath) {
          // Save via backend API
          const result = await saveConfigAs(editedConfig, dialogResult.filePath);
          alert(`✅ Config saved to: ${result.savedPath}`);
          onClose();
          return;
        }
      } catch (error) {
        console.warn("Backend dialog API not available:", error);
        // Fall through to next strategy
      }

      // Strategy 3: Fallback - prompt for path
      const selectedPath = prompt(
        "Enter the file path to save (relative to project root or absolute):\n\n" +
          "Examples:\n" +
          "  configs/my-test.json\n" +
          "  /absolute/path/config.json\n" +
          "  my-config.json",
        suggestedName
      );

      if (!selectedPath) {
        setIsSaving(false);
        return;
      }

      const result = await saveConfigAs(editedConfig, selectedPath);
      alert(`✅ Config saved to: ${result.savedPath}`);
      onClose();
    } catch (error) {
      console.error("Save error:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`❌ Failed to save: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle backdrop click to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Edit Configuration</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${
              activeTab === "json" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("json")}
          >
            📝 JSON Editor
          </button>
          <button
            className={`${styles.tab} ${
              activeTab === "form" ? styles.activeTab : ""
            }`}
            onClick={() => setActiveTab("form")}
            disabled
            title="Form editor coming soon"
          >
            📋 Form Editor (Coming Soon)
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === "json" && (
            <JsonEditorTab
              config={editedConfig}
              onChange={setEditedConfig}
            />
          )}
          {activeTab === "form" && (
            <div className={styles.comingSoon}>
              <p>Form editor will be available soon!</p>
              <p>Use the JSON editor for now.</p>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className="secondary">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "💾 Save to File"}
          </button>
        </div>
      </div>
    </div>
  );
}
