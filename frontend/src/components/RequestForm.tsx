import { useState, ChangeEvent } from "react";
import { HeadersEditor } from "./HeadersEditor";

export interface RequestConfig {
  request_headers: Record<string, string>;
  request_body: string;
  request_trailers: Record<string, string>;
}

interface RequestFormProps {
  value: RequestConfig;
  onChange: (config: RequestConfig) => void;
}

export function RequestForm({ value, onChange }: RequestFormProps) {
  const updateHeaders = (headers: Record<string, string>) => {
    onChange({ ...value, request_headers: headers });
  };

  const updateBody = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...value, request_body: e.target.value });
  };

  const updateTrailers = (trailers: Record<string, string>) => {
    onChange({ ...value, request_trailers: trailers });
  };

  return (
    <section>
      <h2>2. Configure Request</h2>
      <HeadersEditor
        title="Request Headers"
        value={value.request_headers}
        onChange={updateHeaders}
      />
      <div>
        <label>Request Body:</label>
        <textarea
          rows={4}
          value={value.request_body}
          onChange={updateBody}
          placeholder='{"key": "value"}'
        />
      </div>
      <HeadersEditor
        title="Request Trailers"
        value={value.request_trailers}
        onChange={updateTrailers}
      />
    </section>
  );
}
