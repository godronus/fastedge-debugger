import { HttpRequestPanel } from "../../components/http-wasm/HttpRequestPanel";
import { HttpResponsePanel } from "../../components/http-wasm/HttpResponsePanel";
import styles from "./HttpWasmView.module.css";

export function HttpWasmView() {
  return (
    <div className={styles.httpWasmView}>
      <div className={styles.panels}>
        <HttpRequestPanel />
        <HttpResponsePanel />
      </div>
    </div>
  );
}
