import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type KanbanPlugin from "../main";
import { isSafeVaultPath } from "../utils";

export class KanbanSettingTab extends PluginSettingTab {
  private plugin: KanbanPlugin;

  constructor(app: App, plugin: KanbanPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── Data ─────────────────────────────────────────────────────────────────

    new Setting(containerEl).setName("Data").setHeading();

    new Setting(containerEl)
      .setName("Board data file")
      .setDesc(
        "Path (relative to vault root) where board data is stored. " +
        "This file is a regular vault file, so S3sync will sync it to S3 automatically. " +
        "Reload the plugin after changing this path."
      )
      .addText((text) =>
        text
          .setPlaceholder("kanban/boards.json")
          .setValue(this.plugin.settings.dataFilePath)
          .onChange(async (v) => {
            const trimmed = v.trim();
            if (!trimmed) return;
            // Reject absolute paths and traversal segments before persisting.
            if (!isSafeVaultPath(trimmed)) {
              new Notice("Invalid path — must be vault-relative (no leading slash or traversal).", 5000);
              return;
            }
            this.plugin.settings.dataFilePath = trimmed;
            await this.plugin.saveSettings();
            new Notice("Obsidban: data file path updated. Reload the plugin to apply.", 5000);
          })
      );

    const boards = this.plugin.store.getBoards();
    new Setting(containerEl)
      .setName("Board count")
      .setDesc(`${boards.length} board${boards.length !== 1 ? "s" : ""} currently loaded.`);

    // ── Default board ─────────────────────────────────────────────────────────

    new Setting(containerEl).setName("View").setHeading();

    new Setting(containerEl)
      .setName("Default board")
      .setDesc("The board shown when you open the kanban view.")
      .addDropdown((drop) => {
        drop.addOption("", "— none —");
        for (const b of boards) drop.addOption(b.id, b.title);
        drop.setValue(this.plugin.settings.defaultBoardId);
        drop.onChange(async (v) => {
          this.plugin.settings.defaultBoardId = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Show due dates on cards")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showDueDates).onChange(async (v) => {
          this.plugin.settings.showDueDates = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName("Show tags on cards")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showTags).onChange(async (v) => {
          this.plugin.settings.showTags = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        })
      );
  }
}
