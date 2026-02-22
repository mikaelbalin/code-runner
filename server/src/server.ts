import { spawn } from "node:child_process";
import { mkdtemp, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express, { type Request, type Response } from "express";

const app = express();
const PORT = process.env.PORT ?? 3000;
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS ?? "30000", 10);
const PODMAN_IMAGE = process.env.PODMAN_IMAGE ?? "rust-runner";
const [PODMAN_CMD, ...PODMAN_CMD_PREFIX_ARGS] = (process.env.PODMAN_CMD ?? "distrobox-host-exec podman").split(" ");

app.use(express.json({ limit: "1mb" }));

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  error?: string;
}

async function runInPodman(codePath: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const args = [
      "run",
      "--rm",
      "--network",
      "none",
      "--memory",
      "256m",
      "--cpus",
      "0.5",
      "-v",
      `${codePath}:/app/code.rs:Z,ro`,
      PODMAN_IMAGE,
      "/app/code.rs",
    ];

    const child = spawn(PODMAN_CMD, [...PODMAN_CMD_PREFIX_ARGS, ...args]);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: null,
        timedOut,
        error: `Failed to spawn podman: ${err.message}`,
      });
    });
  });
}

app.post("/run", async (req: Request, res: Response) => {
  const { code } = req.body as { code?: unknown };

  if (typeof code !== "string" || code.trim() === "") {
    res.status(400).json({ error: "Field 'code' must be a non-empty string." });
    return;
  }

  let tmpDir: string | null = null;
  let codePath: string | null = null;

  try {
    tmpDir = await mkdtemp(join(tmpdir(), "rust-runner-"));
    codePath = join(tmpDir, "main.rs");
    await writeFile(codePath, code, "utf-8");

    const result = await runInPodman(codePath);

    if (result.timedOut) {
      res.status(408).json({
        error: `Execution timed out after ${TIMEOUT_MS}ms.`,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: null,
        timedOut: true,
      });
      return;
    }

    if (result.error) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Internal server error: ${message}` });
  } finally {
    if (codePath) await unlink(codePath).catch(() => {});
    if (tmpDir) {
      const { rmdir } = await import("node:fs/promises");
      await rmdir(tmpDir).catch(() => {});
    }
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`rust-runner server listening on port ${PORT}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms | Image: ${PODMAN_IMAGE}`);
});
