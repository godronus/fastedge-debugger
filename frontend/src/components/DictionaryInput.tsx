import { useState, useEffect } from "react";

interface DefaultValue {
  value: string;
  enabled?: boolean; // Whether the default should be checked (default: true)
  placeholder?: string; // Optional placeholder for this specific row
}

interface DictionaryInputProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  defaultValues?: Record<string, string | DefaultValue>; // Default key-value pairs with optional enabled state
}

interface Row {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  placeholder?: string; // Per-row placeholder override
}

export function DictionaryInput({
  value,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  defaultValues = {},
}: DictionaryInputProps) {
  const [rows, setRows] = useState<Row[]>(() => {
    // Build maps to track which keys come from defaults and their properties
    const defaultsMap = new Map<string, boolean>();
    const placeholdersMap = new Map<string, string>();

    // Process defaultValues to normalize them and track enabled state + placeholders
    Object.entries(defaultValues).forEach(([key, val]) => {
      if (typeof val === "string") {
        defaultsMap.set(key, true); // String defaults are enabled by default
      } else {
        defaultsMap.set(key, val.enabled ?? true); // Use specified enabled state or default to true
        if (val.placeholder) {
          placeholdersMap.set(key, val.placeholder);
        }
      }
    });

    // Normalize defaultValues to simple key-value pairs
    const normalizedDefaults: Record<string, string> = {};
    Object.entries(defaultValues).forEach(([key, val]) => {
      normalizedDefaults[key] = typeof val === "string" ? val : val.value;
    });

    // Merge defaultValues with value prop (value prop overrides defaults)
    const mergedValues = { ...normalizedDefaults, ...value };

    // Initialize rows from merged values (only runs once)
    const entries = Object.entries(mergedValues).filter(
      ([k, v]) => k.trim() !== "" || v.trim() !== "",
    );
    if (entries.length === 0) {
      // Start with one empty row
      return [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }];
    } else {
      const newRows = entries.map(([key, val]) => ({
        id: crypto.randomUUID(),
        key,
        value: val,
        // Use the enabled state from defaultsMap if this key came from defaults,
        // otherwise check if it exists in value prop (if so, it's enabled)
        enabled: defaultsMap.has(key)
          ? defaultsMap.get(key)!
          : value.hasOwnProperty(key),
        // Use the placeholder from placeholdersMap if available
        placeholder: placeholdersMap.get(key),
      }));
      // Add one empty row at the end
      newRows.push({
        id: crypto.randomUUID(),
        key: "",
        value: "",
        enabled: true,
      });
      return newRows;
    }
  });

  const updateParent = (updatedRows: Row[]) => {
    const dict: Record<string, string> = {};
    updatedRows.forEach((row) => {
      if (row.enabled && row.key.trim() && row.value.trim()) {
        dict[row.key.trim()] = row.value.trim();
      }
    });
    onChange(dict);
  };

  const handleKeyChange = (id: string, newKey: string) => {
    const updatedRows = rows.map((row) =>
      row.id === id ? { ...row, key: newKey } : row,
    );

    // If this is the last row and now has content, add a new empty row
    const lastRow = updatedRows[updatedRows.length - 1];
    if (lastRow.id === id && (newKey.trim() || lastRow.value.trim())) {
      updatedRows.push({
        id: crypto.randomUUID(),
        key: "",
        value: "",
        enabled: true,
      });
    }

    setRows(updatedRows);
    updateParent(updatedRows);
  };

  const handleValueChange = (id: string, newValue: string) => {
    const updatedRows = rows.map((row) =>
      row.id === id ? { ...row, value: newValue } : row,
    );

    // If this is the last row and now has content, add a new empty row
    const lastRow = updatedRows[updatedRows.length - 1];
    if (lastRow.id === id && (lastRow.key.trim() || newValue.trim())) {
      updatedRows.push({
        id: crypto.randomUUID(),
        key: "",
        value: "",
        enabled: true,
      });
    }

    setRows(updatedRows);
    updateParent(updatedRows);
  };

  const handleEnabledChange = (id: string, enabled: boolean) => {
    const updatedRows = rows.map((row) =>
      row.id === id ? { ...row, enabled } : row,
    );
    setRows(updatedRows);
    updateParent(updatedRows);
  };

  const handleDelete = (id: string) => {
    const updatedRows = rows.filter((row) => row.id !== id);
    // Ensure at least one empty row remains
    if (updatedRows.length === 0) {
      updatedRows.push({
        id: crypto.randomUUID(),
        key: "",
        value: "",
        enabled: true,
      });
    }
    setRows(updatedRows);
    updateParent(updatedRows);
  };

  return (
    <div className="dictionary-input">
      <div className="dictionary-header">
        <div className="dictionary-header-enabled"></div>
        <div className="dictionary-header-key">{keyPlaceholder}</div>
        <div className="dictionary-header-value">{valuePlaceholder}</div>
        <div className="dictionary-header-actions"></div>
      </div>
      {rows.map((row, index) => (
        <div key={row.id} className="dictionary-row">
          <div className="dictionary-enabled">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => handleEnabledChange(row.id, e.target.checked)}
              disabled={!row.key.trim() && !row.value.trim()}
            />
          </div>
          <input
            type="text"
            className="dictionary-key"
            value={row.key}
            onChange={(e) => handleKeyChange(row.id, e.target.value)}
            placeholder={keyPlaceholder}
            style={{ opacity: row.enabled ? 1 : 0.5 }}
          />
          <input
            type="text"
            className="dictionary-value"
            value={row.value}
            onChange={(e) => handleValueChange(row.id, e.target.value)}
            placeholder={row.placeholder || valuePlaceholder}
            style={{ opacity: row.enabled ? 1 : 0.5 }}
          />
          <button
            className="dictionary-delete"
            onClick={() => handleDelete(row.id)}
            disabled={rows.length === 1}
            title="Delete row"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
