import { DictionaryInput } from "../DictionaryInput";

interface DefaultValue {
  value: string;
  enabled?: boolean;
  placeholder?: string;
}

interface HeadersEditorProps {
  title: string;
  value: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
  defaultValues?: Record<string, string | DefaultValue>;
}

export function HeadersEditor({
  title,
  value,
  onChange,
  defaultValues,
}: HeadersEditorProps) {
  return (
    <div>
      <label>{title}:</label>
      <DictionaryInput
        value={value}
        onChange={onChange}
        keyPlaceholder="Header name"
        valuePlaceholder="Header value"
        defaultValues={defaultValues}
      />
    </div>
  );
}
