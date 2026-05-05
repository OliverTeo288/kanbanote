import { App, Modal, Notice, Setting } from "obsidian";
import type KanbanPlugin from "../main";
import type { Board, Column } from "../types";
import { FOCUS_DELAY_MS } from "../utils";

const PRESET_COLORS: { label: string; value: string }[] = [
  { label: "Blue",   value: "#4a90d9" },
  { label: "Orange", value: "#e07b39" },
  { label: "Green",  value: "#4caf50" },
  { label: "Red",    value: "#e53935" },
  { label: "Purple", value: "#8e44ad" },
  { label: "Pink",   value: "#e91e8c" },
  { label: "Yellow", value: "#f9a825" },
  { label: "None",   value: "" },
];

/** Replaces window.prompt for column name input. */
export class AddColumnModal extends Modal {
  private plugin: KanbanPlugin;
  private boardId: string;
  private name = "";

  constructor(app: App, plugin: KanbanPlugin, boardId: string) {
    super(app);
    this.plugin  = plugin;
    this.boardId = boardId;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("kanban-modal");
    contentEl.createEl("h2", { text: "Add column" });

    new Setting(contentEl)
      .setName("Column name")
      .addText((text) => {
        text.setPlaceholder("E.g. In review").onChange((v) => { this.name = v; });
        text.inputEl.addClass("kanban-modal-input--full");
        activeWindow.setTimeout(() => text.inputEl.focus(), FOCUS_DELAY_MS);
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") this.submit();
        });
      });

    const footer = contentEl.createDiv({ cls: "kanban-modal-footer" });
    footer.createDiv({ cls: "kanban-modal-footer-spacer" });
    footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    footer.createEl("button", { cls: "mod-cta", text: "Add" }).addEventListener("click", () => this.submit());
  }

  onClose(): void { this.contentEl.empty(); }

  private submit(): void {
    const name = this.name.trim();
    if (!name) { new Notice("Column name is required."); return; }
    this.plugin.store.addColumn(this.boardId, name);
    this.plugin.refreshViews();
    this.close();
  }
}

/** Replaces window.confirm for destructive actions. */
export class ConfirmModal extends Modal {
  private message: string;
  private onConfirm: () => void;

  constructor(app: App, message: string, onConfirm: () => void) {
    super(app);
    this.message   = message;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("kanban-modal");
    contentEl.createEl("p", { text: this.message });

    const footer = contentEl.createDiv({ cls: "kanban-modal-footer" });
    footer.createDiv({ cls: "kanban-modal-footer-spacer" });
    footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    footer.createEl("button", { cls: "mod-warning", text: "Delete" })
      .addEventListener("click", () => { this.onConfirm(); this.close(); });
  }

  onClose(): void { this.contentEl.empty(); }
}

export class NewBoardModal extends Modal {
  private plugin: KanbanPlugin;
  private name = "";

  constructor(app: App, plugin: KanbanPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("kanban-modal");
    contentEl.createEl("h2", { text: "New board" });

    new Setting(contentEl)
      .setName("Board name")
      .addText((text) => {
        text.setPlaceholder("E.g. Sprint 1").onChange((v) => { this.name = v; });
        text.inputEl.addClass("kanban-modal-input--full");
        activeWindow.setTimeout(() => text.inputEl.focus(), FOCUS_DELAY_MS);
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") this.submit();
        });
      });

    const footer = contentEl.createDiv({ cls: "kanban-modal-footer" });
    footer.createDiv({ cls: "kanban-modal-footer-spacer" });
    footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    footer.createEl("button", { cls: "mod-cta", text: "Create" }).addEventListener("click", () => this.submit());
  }

  onClose(): void { this.contentEl.empty(); }

  private submit(): void {
    const name = this.name.trim();
    if (!name) { new Notice("Board name is required."); return; }

    const board = this.plugin.store.createBoard(name);
    // Seed every new board with three default columns.
    this.plugin.store.addColumn(board.id, "To Do",        "var(--color-blue)");
    this.plugin.store.addColumn(board.id, "In Progress",  "var(--color-orange)");
    this.plugin.store.addColumn(board.id, "Done",         "var(--color-green)");

    this.plugin.refreshViews();
    this.close();
  }
}

export class SetColumnColorModal extends Modal {
  private plugin: KanbanPlugin;
  private boardId: string;
  private col: Column;
  private selected: string;

  constructor(app: App, plugin: KanbanPlugin, boardId: string, col: Column) {
    super(app);
    this.plugin   = plugin;
    this.boardId  = boardId;
    this.col      = col;
    this.selected = col.color ?? "";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("kanban-modal");
    new Setting(contentEl).setName("Column color").setHeading();

    const swatches = contentEl.createDiv({ cls: "kanban-color-swatches" });
    for (const preset of PRESET_COLORS) {
      const sw = swatches.createDiv({ cls: "kanban-color-swatch" });
      if (!preset.value) sw.addClass("kanban-color-swatch--none");
      else sw.style.background = preset.value;
      if (this.selected === preset.value) sw.addClass("kanban-color-swatch--active");
      sw.title = preset.label;
      sw.addEventListener("click", () => {
        swatches.querySelectorAll(".kanban-color-swatch--active")
          .forEach((el) => el.removeClass("kanban-color-swatch--active"));
        sw.addClass("kanban-color-swatch--active");
        this.selected  = preset.value;
        picker.value   = preset.value || "#000000";
      });
    }

    new Setting(contentEl)
      .setName("Custom color")
      .addColorPicker((cp) => {
        cp.setValue(this.selected || "#4a90d9");
        cp.onChange((v) => {
          this.selected = v;
          swatches.querySelectorAll(".kanban-color-swatch--active")
            .forEach((el) => el.removeClass("kanban-color-swatch--active"));
        });
      });

    // Sync preset swatch clicks into the native color picker.
    const picker = contentEl.querySelector("input[type=color]") as HTMLInputElement ?? { value: "" } as HTMLInputElement;

    const footer = contentEl.createDiv({ cls: "kanban-modal-footer" });
    footer.createDiv({ cls: "kanban-modal-footer-spacer" });
    footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    footer.createEl("button", { cls: "mod-cta", text: "Apply" }).addEventListener("click", () => this.apply());
  }

  onClose(): void { this.contentEl.empty(); }

  private apply(): void {
    this.plugin.store.setColumnColor(this.boardId, this.col.id, this.selected);
    this.plugin.refreshViews();
    this.close();
  }
}

export class RenameBoardModal extends Modal {
  private plugin: KanbanPlugin;
  private board: Board;
  private name = "";

  constructor(app: App, plugin: KanbanPlugin, board: Board) {
    super(app);
    this.plugin = plugin;
    this.board  = board;
    this.name   = board.title;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("kanban-modal");
    contentEl.createEl("h2", { text: "Rename board" });

    new Setting(contentEl)
      .setName("Board name")
      .addText((text) => {
        text.setValue(this.name).onChange((v) => { this.name = v; });
        text.inputEl.addClass("kanban-modal-input--full");
        activeWindow.setTimeout(() => { text.inputEl.focus(); text.inputEl.select(); }, FOCUS_DELAY_MS);
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") this.submit();
        });
      });

    const footer = contentEl.createDiv({ cls: "kanban-modal-footer" });
    footer.createDiv({ cls: "kanban-modal-footer-spacer" });
    footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    footer.createEl("button", { cls: "mod-cta", text: "Save" }).addEventListener("click", () => this.submit());
  }

  onClose(): void { this.contentEl.empty(); }

  private submit(): void {
    const name = this.name.trim();
    if (!name) { new Notice("Board name is required."); return; }
    this.plugin.store.renameBoard(this.board.id, name);
    this.plugin.refreshViews();
    this.close();
  }
}
