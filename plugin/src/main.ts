import { Plugin, requestUrl } from "obsidian";
import {
  type CodeRunnerPluginSettings,
  CodeRunnerSettingTab,
  DEFAULT_SETTINGS,
} from "./settings";

export default class CodeRunnerPlugin extends Plugin {
  settings!: CodeRunnerPluginSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CodeRunnerSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor("rust", (source, el) => {
      const wrapper = el.createDiv({ cls: "rust-runner" });

      const pre = wrapper.createEl("pre");
      pre.createEl("code", { cls: "language-rust", text: source });

      const btn = wrapper.createEl("button", {
        cls: "rust-runner-btn",
        text: "▶ Run",
      });

      const output = wrapper.createDiv({ cls: "rust-runner-output" });
      output.hide();

      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Running…";
        output.empty();
        output.show();
        output.createEl("span", {
          cls: "rust-runner-loading",
          text: "Running…",
        });

        try {
          const resp = await requestUrl({
            url: `${this.settings.serverUrl}/run`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: source }),
            throw: false,
          });

          output.empty();

          if (resp.status === 408) {
            output.createEl("pre", {
              cls: "rust-runner-error",
              text: "⏱ Timeout: execution took too long.",
            });
            return;
          }

          const data = resp.json as {
            stdout: string;
            stderr: string;
            exitCode: number | null;
            timedOut?: boolean;
            error?: string;
          };

          if (data.error) {
            output.createEl("pre", {
              cls: "rust-runner-error",
              text: `Error: ${data.error}`,
            });
            return;
          }

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
          output.empty();
          output.createEl("pre", {
            cls: "rust-runner-error",
            text: `Failed to connect to server: ${String(err)}`,
          });
        } finally {
          btn.disabled = false;
          btn.textContent = "▶ Run";
        }
      });
    });
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<CodeRunnerPluginSettings>
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
