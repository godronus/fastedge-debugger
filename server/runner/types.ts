export type HeaderMap = Record<string, string>;

export type HookCall = {
  hook: string;
  request: {
    headers: HeaderMap;
    body: string;
    method?: string;
    path?: string;
    scheme?: string;
  };
  response: {
    headers: HeaderMap;
    body: string;
    status?: number;
    statusText?: string;
  };
  properties: Record<string, unknown>;
  logLevel?: number; // Optional log level filter (0=trace, 1=debug, 2=info, 3=warn, 4=error, 5=critical)
};

export type HookResult = {
  returnCode: number | null;
  logs: { level: number; message: string }[];
  request: { headers: HeaderMap; body: string };
  response: {
    headers: HeaderMap;
    body: string;
  };
  properties: Record<string, unknown>;
};

export enum ProxyStatus {
  Ok = 0,
  NotFound = 1,
  BadArgument = 2,
}

export enum BufferType {
  RequestBody = 0,
  ResponseBody = 1,
  VmConfiguration = 6,
  PluginConfiguration = 7,
}

export enum MapType {
  RequestHeaders = 0,
  ResponseHeaders = 1,
}

export type LogEntry = {
  level: number;
  message: string;
};
