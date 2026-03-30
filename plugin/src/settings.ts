import { type App, PluginSettingTab, Setting } from "obsidian";
import type CodeRunnerPlugin from "./main";

export interface CodeRunnerPluginSettings {
  serverUrl: string;
}

export const DEFAULT_SETTINGS: CodeRunnerPluginSettings = {
  serverUrl: "http://localhost:3000",
};

export class CodeRunnerSettingTab extends PluginSettingTab {
  plugin: CodeRunnerPlugin;

  constructor(app: App, plugin: CodeRunnerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Rust Runner" });

    new Setting(containerEl)
      .setName("Server URL")
      .setDesc("Address of the rust-runner backend server.")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:3000")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trimEnd().replace(/\/$/, "");
            await this.plugin.saveSettings();
          })
      );
  }
}
