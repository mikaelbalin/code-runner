import { Plugin, requestUrl } from "obsidian";
import {
  type CodeRunnerPluginSettings,
  CodeRunnerSettingTab,
  DEFAULT_SETTINGS,
} from "./settings";

export default class CodeRunnerPlugin extends Plugin {
  settings!: CodeRunnerPluginSettings;

  async onload() {
    // Load persisted settings before anything else
    await this.loadSettings();
    // Register the settings tab in Obsidian's settings panel
    this.addSettingTab(new CodeRunnerSettingTab(this.app, this));

    // Register a processor for fenced ```rust code blocks
    this.registerMarkdownCodeBlockProcessor("rust", (source, el) => {
      // Container wrapping the code block, run button, and output area
      const wrapper = el.createDiv({ cls: "rust-runner" });

      // Render the raw source with syntax-highlight class so themes can style it
      const pre = wrapper.createEl("pre");
      pre.createEl("code", { cls: "language-rust", text: source });

      // Button that triggers code execution
      const btn = wrapper.createEl("button", {
        cls: "rust-runner-btn",
        text: "▶ Run",
      });

      // Output area is hidden until the user clicks Run
      const output = wrapper.createDiv({ cls: "rust-runner-output" });
      output.hide();

      btn.addEventListener("click", async () => {
        // Disable button and show loading state while waiting for the server
        btn.disabled = true;
        btn.textContent = "Running…";
        output.empty();
        output.show();
        output.createEl("span", {
          cls: "rust-runner-loading",
          text: "Running…",
        });

        try {
          // Send the source code to the local execution server; throw:false
          // prevents Obsidian from throwing on non-2xx status codes so we can
          // handle error responses (e.g. 408 timeout) manually.
          const resp = await requestUrl({
            url: `${this.settings.serverUrl}/run`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: source }),
            throw: false,
          });

          output.empty();

          // 408 means the server killed the process due to execution timeout
          if (resp.status === 408) {
            output.createEl("pre", {
              cls: "rust-runner-error",
              text: "⏱ Timeout: execution took too long.",
            });
            return;
          }

          // Type-cast the JSON response to the expected server payload shape
          const data = resp.json as {
            stdout: string;
            stderr: string;
            exitCode: number | null;
            timedOut?: boolean;
            error?: string;
          };

          // Server-side errors (e.g. compilation failure details)
          if (data.error) {
            output.createEl("pre", {
              cls: "rust-runner-error",
              text: `Error: ${data.error}`,
            });
            return;
          }

          // Render stdout, stderr, or a placeholder when both are empty
          if (data.stdout)
            output.createEl("pre", {
              cls: "rust-runner-stdout",
              text: data.stdout,
            });
          if (data.stderr)
            output.createEl("pre", {
              cls: "rust-runner-stderr",
              text: data.stderr,
            });
          if (!data.stdout && !data.stderr)
            output.createEl("span", {
              cls: "rust-runner-empty",
              text: "(no output)",
            });
        } catch (err) {
          // Network-level failure (server unreachable, CORS, etc.)
          output.empty();
          output.createEl("pre", {
            cls: "rust-runner-error",
            text: `Failed to connect to server: ${String(err)}`,
          });
        } finally {
          // Always restore the button to its ready state
          btn.disabled = false;
          btn.textContent = "▶ Run";
        }
      });
    });
  }

  onunload() {}

  async loadSettings() {
    // Merge stored data on top of defaults so missing keys always have a value
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<CodeRunnerPluginSettings>
    );
  }

  async saveSettings() {
    // Persist current settings to Obsidian's plugin data store
    await this.saveData(this.settings);
  }
}
