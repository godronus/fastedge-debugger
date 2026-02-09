/**
 * FastEdge CLI Discovery Utility
 *
 * Discovers the FastEdge-run CLI binary in the following order:
 * 1. FASTEDGE_RUN_PATH environment variable
 * 2. Bundled binary in server/fastedge-cli/ (platform-specific)
 * 3. PATH (using 'which' or 'where' command)
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import os from "os";

/**
 * Get the bundled CLI path for the current platform
 * Matches FastEdge-vscode's approach
 */
function getBundledCliPath(): string {
  // Get the directory of this file (dist/utils when compiled)
  // __dirname is available in CommonJS (see server/tsconfig.json)
  const currentDir = __dirname;

  // Navigate from dist/utils to project root, then to fastedge-cli/
  // dist/utils -> dist -> project-root -> fastedge-cli
  const cliBinDir = join(currentDir, "..", "..", "fastedge-cli");

  switch (os.platform()) {
    case "win32":
      return join(cliBinDir, "fastedge-run.exe");
    case "darwin":
      return join(cliBinDir, "fastedge-run-darwin-arm64");
    case "linux":
      return join(cliBinDir, "fastedge-run-linux-x64");
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}

/**
 * Find the FastEdge-run CLI binary
 * @returns The absolute path to the fastedge-run binary
 * @throws Error if the CLI is not found
 */
export async function findFastEdgeRunCli(): Promise<string> {
  // 1. Check FASTEDGE_RUN_PATH environment variable
  const envPath = process.env.FASTEDGE_RUN_PATH;
  if (envPath) {
    if (existsSync(envPath)) {
      return envPath;
    } else {
      throw new Error(
        `FASTEDGE_RUN_PATH is set to "${envPath}" but the file does not exist`
      );
    }
  }

  // 2. Check for bundled binary
  try {
    const bundledPath = getBundledCliPath();
    if (existsSync(bundledPath)) {
      return bundledPath;
    }
  } catch (error) {
    // Platform not supported or path doesn't exist, continue to next option
  }

  // 3. Check PATH using 'which' (Unix) or 'where' (Windows)
  try {
    const command =
      process.platform === "win32" ? "where fastedge-run" : "which fastedge-run";
    const result = execSync(command, { encoding: "utf8" }).trim();

    // On Windows, 'where' can return multiple lines; take the first
    const firstPath = result.split("\n")[0].trim();

    if (firstPath && existsSync(firstPath)) {
      return firstPath;
    }
  } catch (error) {
    // Command failed (binary not in PATH)
  }

  // Not found anywhere
  throw new Error(
    "fastedge-run CLI not found in any of these locations:\n" +
      "  1. FASTEDGE_RUN_PATH environment variable\n" +
      "  2. Bundled binary in fastedge-cli/ (project root)\n" +
      "  3. System PATH\n\n" +
      "To fix this:\n" +
      "  - Set FASTEDGE_RUN_PATH environment variable, or\n" +
      "  - Install fastedge-run in PATH: cargo install fastedge-run, or\n" +
      "  - Place the binary in fastedge-cli/ at project root (platform-specific filename)"
  );
}

/**
 * Verify the FastEdge-run CLI is functional
 * @param cliPath Path to the CLI binary
 * @returns true if the CLI is functional
 */
export async function verifyFastEdgeRunCli(cliPath: string): Promise<boolean> {
  try {
    execSync(`"${cliPath}" --version`, { encoding: "utf8", timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}
