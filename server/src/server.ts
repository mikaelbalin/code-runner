import { spawn } from "node:child_process";
import { mkdtemp, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express, { type Request, type Response } from "express";

const app = express();
const PORT = process.env.PORT ?? 3000;
// Maximum time (ms) a container is allowed to run before being forcefully killed
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS ?? "30000", 10);
// Name of the Podman/Docker image used to compile and run submitted Rust code
const PODMAN_IMAGE = process.env.PODMAN_IMAGE ?? "rust-runner";
// Support multi-word commands like "distrobox-host-exec podman" by splitting into cmd + prefix args
const [PODMAN_CMD, ...PODMAN_CMD_PREFIX_ARGS] = (
  process.env.PODMAN_CMD ?? "distrobox-host-exec podman"
).split(" ");

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
      "--rm", // automatically remove the container after it exits
      "--network",
      "none", // disable network access for security isolation
      "--memory",
      "256m", // cap memory usage to prevent runaway allocations
      "--cpus",
      "0.5", // limit to half a CPU core to avoid starving the host
      "-v",
      `${codePath}:/app/code.rs:Z,ro`, // mount the source file read-only; :Z sets the SELinux label
      PODMAN_IMAGE,
      "/app/code.rs", // path passed to the container entrypoint (compile + run)
    ];

    const child = spawn(PODMAN_CMD, [...PODMAN_CMD_PREFIX_ARGS, ...args]);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    // Force-kill the container if it exceeds the allowed runtime
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
      // Fired when the process could not be spawned at all (e.g. podman not found)
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

  // Reject missing or blank submissions before doing any disk I/O
  if (typeof code !== "string" || code.trim() === "") {
    res.status(400).json({ error: "Field 'code' must be a non-empty string." });
    return;
  }

  let tmpDir: string | null = null;
  let codePath: string | null = null;

  try {
    // Create an isolated temp directory so concurrent requests don't collide
    tmpDir = await mkdtemp(join(tmpdir(), "rust-runner-"));
    codePath = join(tmpDir, "main.rs");
    // Write the submitted source code to disk so it can be bind-mounted into the container
    await writeFile(codePath, code, "utf-8");

    const result = await runInPodman(codePath);

    // HTTP 408 Request Timeout — container was killed by the watchdog timer
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

    // Spawn-level error (e.g. podman binary missing); distinct from a non-zero exit code
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
    // Always clean up temp files, even if an error was thrown above
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
