import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { KanbanBoardView, KANBAN_VIEW_TYPE } from "./ui/boardView";
import { NewBoardModal } from "./ui/boardModal";
import { KanbanSettingTab } from "./ui/settings";
import { BoardStore } from "./store";
import {
  DEFAULT_SETTINGS,
  type KanbanPluginData,
  type KanbanSettings,
  type KanbanVaultData,
} from "./types";
import { extractErrorMessage, isSafeVaultPath } from "./utils";
import type { Board, Card } from "./types";

export default class KanbanPlugin extends Plugin {
  settings!: KanbanSettings;
  store!: BoardStore;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Plugin entry point. Synchronous to satisfy `Plugin.onload(): void`.
   * Sync registrations run first, then `hydrate()` loads persisted data in the
   * background. Views read state via `this.plugin.store` lookups at render
   * time, so the placeholder store created here is safely replaced once
   * hydration completes.
   */
  onload(): void {
    // Synchronous defaults — overwritten by hydrate() once disk read completes.
    this.settings = { ...DEFAULT_SETTINGS };
    this.store    = new BoardStore([], () => void this.persistBoards());

    this.registerView(KANBAN_VIEW_TYPE, (leaf) => new KanbanBoardView(leaf, this));

    const ribbonEl = this.addRibbonIcon("table-2", "Open kanban board", () => {
      void this.activateView();
    });
    ribbonEl.addClass("kanbanote-ribbon");

    this.addCommand({
      id: "open-kanban-board",
      name: "Open board",
      icon: "table-2",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "new-kanban-board",
      name: "Create new board",
      icon: "plus-square",
      callback: () => new NewBoardModal(this.app, this).open(),
    });

    this.addSettingTab(new KanbanSettingTab(this.app, this));

    // Async hydration — fire-and-forget; refreshViews() updates any open views.
    void this.hydrate();
  }

  onunload(): void { /* nothing to tear down */ }

  // ── View activation ───────────────────────────────────────────────────────

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: KANBAN_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  refreshViews(): void {
    this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE).forEach((leaf: WorkspaceLeaf) => {
      if (leaf.view instanceof KanbanBoardView) {
        leaf.view.render();
      }
    });
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /**
   * Load settings from plugin storage (.obsidian/plugins/kanbanote/data.json)
   * then load boards from the vault data file (kanban/boards.json by default).
   * Replaces the placeholder store created in onload() and re-renders any
   * open views so they pick up the loaded data.
   *
   * Settings stay in plugin storage so they are device-local and not synced.
   * Board data lives in the vault so S3sync picks it up automatically.
   */
  private async hydrate(): Promise<void> {
    try {
      const pluginData = (await this.loadData()) as Partial<KanbanPluginData> | null;
      this.settings = { ...DEFAULT_SETTINGS, ...(pluginData?.settings ?? {}) };

      const boards = await this.readVaultFile();
      this.store = new BoardStore(boards, () => void this.persistBoards());
      this.refreshViews();
    } catch (err: unknown) {
      // Surface load failures to the user — otherwise the placeholder store
      // sticks around silently and they see an empty board with no explanation.
      new Notice(`Kanbanote: failed to load boards — ${extractErrorMessage(err)}`, 6000);
    }
  }

  /** Write board data to the vault file so S3sync can sync it. */
  private async persistBoards(): Promise<void> {
    const path = this.settings.dataFilePath;

    // Reject path traversal or absolute paths before any adapter call.
    if (!isSafeVaultPath(path)) {
      new Notice("Kanbanote: data file path is invalid — check settings.", 6000);
      return;
    }

    const dir = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";

    try {
      if (dir && !(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.createFolder(dir);
      }
      const payload: KanbanVaultData = { boards: this.store.getBoards() };
      await this.app.vault.adapter.write(path, JSON.stringify(payload, null, 2));
    } catch (err: unknown) {
      new Notice(`Kanbanote: failed to save boards — ${extractErrorMessage(err)}`, 6000);
    }
  }

  /** Read board data from the vault file. Returns [] if the file doesn't exist yet. */
  private async readVaultFile(): Promise<KanbanVaultData["boards"]> {
    const path = this.settings.dataFilePath;

    // Reject traversal before hitting the adapter.
    if (!isSafeVaultPath(path)) return [];

    try {
      if (!(await this.app.vault.adapter.exists(path))) return [];
      const raw = JSON.parse(await this.app.vault.adapter.read(path)) as Partial<KanbanVaultData>;

      // Validate structure and deep-clone to prevent prototype pollution from
      // untrusted JSON (e.g. crafted via the vault sync).
      if (!Array.isArray(raw.boards)) return [];
      return migrateBoards(structuredClone(raw.boards));
    } catch {
      return [];
    }
  }

  /** Save only the settings back to plugin storage. */
  async saveSettings(): Promise<void> {
    const payload: KanbanPluginData = { settings: this.settings };
    await this.saveData(payload);
  }
}

/**
 * One-time forward migration: convert old single-string `assignee` field to `assignees` array.
 * Safe to run on already-migrated data (Array.isArray guard is a no-op).
 */
function migrateBoards(boards: Board[]): Board[] {
  for (const board of boards) {
    for (const col of board.columns) {
      for (const card of col.cards) {
        const legacy = card as Card & { assignee?: string; linkedNote?: string };

        // Migrate single assignee string → assignees array
        if (!Array.isArray(card.assignees)) {
          card.assignees = legacy.assignee ? [legacy.assignee] : [];
          delete legacy.assignee;
        }

        // Migrate linkedNote → attachments (prepend so it stays visible)
        if (legacy.linkedNote) {
          if (!card.attachments.includes(legacy.linkedNote)) {
            card.attachments.unshift(legacy.linkedNote);
          }
          delete legacy.linkedNote;
        }
      }
    }
  }
  return boards;
}
