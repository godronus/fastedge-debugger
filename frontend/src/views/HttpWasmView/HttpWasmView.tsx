import { HttpRequestPanel } from "../../components/http-wasm/HttpRequestPanel";
import { HttpResponsePanel } from "../../components/http-wasm/HttpResponsePanel";
import styles from "./HttpWasmView.module.css";

export function HttpWasmView() {
  return (
    <div className={styles.httpWasmView}>
      <div className={styles.header}>
        <h2>HTTP WASM Test Runner</h2>
        <p className={styles.description}>
          Configure and execute HTTP requests through your WASM binary
        </p>
      </div>

      <div className={styles.panels}>
        <HttpRequestPanel />
        <HttpResponsePanel />
      </div>
    </div>
  );
}
