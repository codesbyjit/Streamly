import { spawn } from "node:child_process";
import { config } from "./config.js";

export class CommandError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr: string
  ) {
    super(message);
    this.name = "CommandError";
  }
}

export function runCommand(
  command: string,
  args: string[],
  timeoutMs = config.JOB_TIMEOUT_MS
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        reject(new CommandError(`${command} timed out after ${timeoutMs}ms`, null, stderr));
      }
    }, timeoutMs);

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
      // Keep error output bounded for long FFmpeg runs.
      if (stderr.length > 100_000) stderr = stderr.slice(-100_000);
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(new CommandError(`Could not start ${command}: ${error.message}`, null, stderr));
      }
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) resolve({ stdout, stderr });
      else reject(new CommandError(`${command} exited with code ${code}`, code, stderr));
    });
  });
}
