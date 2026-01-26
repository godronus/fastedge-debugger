import { ChangeEvent } from "react";
import { HeadersEditor } from "./HeadersEditor";

export interface ResponseConfig {
  response_headers: Record<string, string>;
  response_body: string;
  response_trailers: Record<string, string>;
}

interface ResponseFormProps {
  value: ResponseConfig;
  onChange: (config: ResponseConfig) => void;
}

export function ResponseForm({ value, onChange }: ResponseFormProps) {
  const updateHeaders = (headers: Record<string, string>) => {
    onChange({ ...value, response_headers: headers });
  };

  const updateBody = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...value, response_body: e.target.value });
  };

  const updateTrailers = (trailers: Record<string, string>) => {
    onChange({ ...value, response_trailers: trailers });
  };

  return (
    <section>
      <h2>3. Configure Response</h2>
      <HeadersEditor
        title="Response Headers"
        value={value.response_headers}
        onChange={updateHeaders}
      />
      <div>
        <label>Response Body:</label>
        <textarea
          rows={4}
          value={value.response_body}
          onChange={updateBody}
          placeholder='{"message": "Hello"}'
        />
      </div>
      <HeadersEditor
        title="Response Trailers"
        value={value.response_trailers}
        onChange={updateTrailers}
      />
    </section>
  );
}
