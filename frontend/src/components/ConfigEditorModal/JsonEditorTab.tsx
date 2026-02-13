import { useState, useEffect } from "react";
import { TestConfig } from "../../api";
import styles from "./JsonEditorTab.module.css";

interface JsonEditorTabProps {
  config: TestConfig;
  onChange: (config: TestConfig) => void;
}

export function JsonEditorTab({ config, onChange }: JsonEditorTabProps) {
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(config, null, 2)
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Update jsonText when config prop changes (from form tab in the future)
  useEffect(() => {
    setJsonText(JSON.stringify(config, null, 2));
  }, [config]);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setJsonText(newText);

    // Validate JSON in real-time
    try {
      const parsed = JSON.parse(newText);

      // Basic structure validation
      if (typeof parsed !== "object" || parsed === null) {
        setValidationError("Config must be a JSON object");
        return;
      }

      // Validate required fields
      if (!parsed.request || typeof parsed.request !== "object") {
        setValidationError("Missing required field: request");
        return;
      }

      if (!parsed.request.method || typeof parsed.request.method !== "string") {
        setValidationError("Missing required field: request.method");
        return;
      }

      if (!parsed.request.url || typeof parsed.request.url !== "string") {
        setValidationError("Missing required field: request.url");
        return;
      }

      if (!parsed.request.headers || typeof parsed.request.headers !== "object") {
        setValidationError("Missing required field: request.headers");
        return;
      }

      if (parsed.request.body === undefined) {
        setValidationError("Missing required field: request.body");
        return;
      }

      if (!parsed.properties || typeof parsed.properties !== "object") {
        setValidationError("Missing required field: properties");
        return;
      }

      if (parsed.logLevel === undefined || typeof parsed.logLevel !== "number") {
        setValidationError("Missing required field: logLevel (must be a number)");
        return;
      }

      // Optional fields validation
      if (parsed.wasm !== undefined) {
        if (typeof parsed.wasm !== "object" || parsed.wasm === null) {
          setValidationError("Field 'wasm' must be an object");
          return;
        }
        if (!parsed.wasm.path || typeof parsed.wasm.path !== "string") {
          setValidationError("Field 'wasm.path' is required when wasm is present");
          return;
        }
      }

      // Valid JSON - update config
      setValidationError(null);
      onChange(parsed as TestConfig);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setValidationError(`Invalid JSON: ${error.message}`);
      } else {
        setValidationError("Unknown validation error");
      }
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonText(formatted);
      setValidationError(null);
      onChange(parsed as TestConfig);
    } catch (error) {
      // Format button won't work if JSON is invalid
      // Error is already shown from real-time validation
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.info}>
          <span className={styles.label}>Edit your configuration as JSON</span>
          {validationError ? (
            <span className={styles.errorBadge}>⚠️ Invalid JSON</span>
          ) : (
            <span className={styles.successBadge}>✓ Valid JSON</span>
          )}
        </div>
        <button
          onClick={handleFormat}
          disabled={!!validationError}
          className="secondary"
          title="Format JSON (Ctrl+Shift+F)"
        >
          🎨 Format
        </button>
      </div>

      {validationError && (
        <div className={styles.error}>
          <strong>Validation Error:</strong> {validationError}
        </div>
      )}

      <textarea
        className={styles.editor}
        value={jsonText}
        onChange={handleJsonChange}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        placeholder='{\n  "description": "My test",\n  ...\n}'
      />

      <div className={styles.footer}>
        <span className={styles.hint}>
          💡 Tip: Use Ctrl+Space for autocomplete (if supported by your editor)
        </span>
      </div>
    </div>
  );
}
