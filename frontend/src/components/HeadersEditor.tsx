import { useState, ChangeEvent } from "react";

interface HeadersEditorProps {
  title: string;
  value: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
}

export function HeadersEditor({ title, value, onChange }: HeadersEditorProps) {
  const [text, setText] = useState(() =>
    Object.entries(value)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
  );

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    const headers: Record<string, string> = {};
    newText.split("\n").forEach((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key && value) {
          headers[key] = value;
        }
      }
    });

    onChange(headers);
  };

  return (
    <div>
      <label>{title}:</label>
      <textarea
        rows={4}
        value={text}
        onChange={handleChange}
        placeholder="key: value"
      />
    </div>
  );
}
