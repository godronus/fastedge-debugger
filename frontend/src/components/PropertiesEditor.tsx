import { useState, ChangeEvent } from "react";

interface PropertiesEditorProps {
  value: Record<string, string>;
  onChange: (properties: Record<string, string>) => void;
}

export function PropertiesEditor({ value, onChange }: PropertiesEditorProps) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    try {
      const parsed = JSON.parse(newText);
      onChange(parsed);
      setError(null);
    } catch (err) {
      setError("Invalid JSON");
    }
  };

  return (
    <div>
      <label>Properties (JSON)</label>
      <textarea
        rows={6}
        value={text}
        onChange={handleChange}
        placeholder='{"key": "value"}'
      />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
