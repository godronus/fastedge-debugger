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
 * Get the CLI binary filename for the current platform
 */
function getCliBinaryName(): string {
  switch (os.platform()) {
    case "win32":
      return "fastedge-run.exe";
    case "darwin":
      return "fastedge-run-darwin-arm64";
    case "linux":
      return "fastedge-run-linux-x64";
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}

/**
 * Get possible bundled CLI paths
 * Checks both production (dist/fastedge-cli/) and source (fastedge-run/) locations
 */
function getBundledCliPaths(): string[] {
  const binaryName = getCliBinaryName();

  return [
    // Production: bundled server at dist/server.js
    join(__dirname, "fastedge-cli", binaryName),

    // Development/Tests: running from source
    // __dirname might be server/utils/, so go up to project root
    join(__dirname, "..", "..", "fastedge-run", binaryName),

    // Alternative: if __dirname is already at project root
    join(__dirname, "fastedge-run", binaryName),
  ];
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

  // 2. Check for bundled binary (multiple possible locations)
  for (const bundledPath of getBundledCliPaths()) {
    if (existsSync(bundledPath)) {
      return bundledPath;
    }
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
