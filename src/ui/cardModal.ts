import { App, Component, FuzzySuggestModal, MarkdownRenderer, Modal, Notice, Setting, TFile, setIcon } from "obsidian";
import type KanbanPlugin from "../main";
import type { Card, ChecklistItem } from "../types";
import { FOCUS_DELAY_MS, timeAgo } from "../utils";

export class CardModal extends Modal {
  private plugin: KanbanPlugin;
  private boardId: string;
  private colId: string;
  private existing: Card | null;

  // ── Form state ────────────────────────────────────────────────────────────
  private title = "";
  private description = "";
  private tags: string[] = [];
  private dueDate = "";
  private assignees: string[] = [];
  private checklist: ChecklistItem[] = [];
  private attachments: string[] = [];

  // ── Stored DOM references (updated live without full re-render) ───────────
  private checklistEl!: HTMLElement;
  private attachmentsEl!: HTMLElement;
  private checklistHeadingNameEl: HTMLElement | null = null;
  private checklistProgressFillEl: HTMLElement | null = null;
  private descPreviewComponent: Component | null = null;

  constructor(app: App, plugin: KanbanPlugin, boardId: string, colId: string, existing: Card | null) {
    super(app);
    this.plugin = plugin;
    this.boardId = boardId;
    this.colId = colId;
    this.existing = existing;

    if (existing) {
      this.title       = existing.title;
      this.description = existing.description;
      this.tags        = [...existing.tags];
      this.dueDate     = existing.dueDate ?? "";
      this.assignees   = [...existing.assignees];
      // Deep-clone so edits don't mutate the store until Save.
      this.checklist   = existing.checklist.map((i) => ({ ...i }));
      this.attachments = [...existing.attachments];
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("kanban-modal", "kanban-card-modal");
    contentEl.createEl("h2", { text: this.existing ? "Edit card" : "New card" });

    this.renderDetails(contentEl);
    this.renderChecklist(contentEl);
    this.renderAttachments(contentEl);
    if (this.existing) this.renderActivity(contentEl);
    this.renderFooter(contentEl);
  }

  onClose(): void {
    this.descPreviewComponent?.unload();
    this.descPreviewComponent = null;
    this.contentEl.empty();
  }

  // ── Details ───────────────────────────────────────────────────────────────

  private renderDetails(root: HTMLElement): void {
    new Setting(root).setName("Details").setHeading();
    this.renderTitleField(root);
    this.renderDescriptionField(root);
    this.renderAssigneesField(root);
    this.renderDueDateField(root);
    this.renderTagsField(root);
  }

  private renderTitleField(root: HTMLElement): void {
    new Setting(root)
      .setName("Title")
      .setDesc("Required.")
      .addText((text) => {
        text.setValue(this.title).onChange((v) => { this.title = v; });
        text.inputEl.addClass("kanban-modal-input--full");
        activeWindow.setTimeout(() => text.inputEl.focus(), FOCUS_DELAY_MS);
      });
  }

  private renderDescriptionField(root: HTMLElement): void {
    const descSection = root.createDiv({ cls: "kanban-desc-section" });
    const descHeader  = descSection.createDiv({ cls: "kanban-desc-header" });
    descHeader.createSpan({ cls: "kanban-desc-label", text: "Description" });

    const tabBar    = descHeader.createDiv({ cls: "kanban-desc-tabs" });
    const writeTab  = tabBar.createEl("button", { cls: "kanban-desc-tab kanban-desc-tab--active", text: "Write",   attr: { type: "button" } });
    const previewTab = tabBar.createEl("button", { cls: "kanban-desc-tab",                          text: "Preview", attr: { type: "button" } });

    const textareaEl = descSection.createEl("textarea", { cls: "kanban-modal-textarea" });
    textareaEl.value = this.description;
    textareaEl.addEventListener("input", () => { this.description = textareaEl.value; });

    const previewEl = descSection.createDiv({ cls: "kanban-description-preview" });
    previewEl.hide();

    writeTab.addEventListener("click", () => {
      writeTab.addClass("kanban-desc-tab--active");
      previewTab.removeClass("kanban-desc-tab--active");
      textareaEl.show();
      previewEl.hide();
    });

    previewTab.addEventListener("click", () => {
      previewTab.addClass("kanban-desc-tab--active");
      writeTab.removeClass("kanban-desc-tab--active");
      textareaEl.hide();
      previewEl.show();
      previewEl.empty();
      this.descPreviewComponent?.unload();
      this.descPreviewComponent = new Component();
      this.descPreviewComponent.load();
      void MarkdownRenderer.render(
        this.app,
        this.description || "*No description.*",
        previewEl,
        "",
        this.descPreviewComponent,
      );
    });
  }

  private renderAssigneesField(root: HTMLElement): void {
    new Setting(root).setName("Assignees").setDesc("Who owns this card.");
    this.renderChipField(
      root,
      () => this.assignees,
      (updated) => { this.assignees = updated; },
      { placeholder: "Add assignee name…", addIcon: "user-plus" },
    );
  }

  private renderDueDateField(root: HTMLElement): void {
    new Setting(root)
      .setName("Due date")
      .addText((text) => {
        text.inputEl.type = "date";
        text.setValue(this.dueDate).onChange((v) => { this.dueDate = v; });
      });
  }

  private renderTagsField(root: HTMLElement): void {
    new Setting(root).setName("Tags");
    this.renderChipField(
      root,
      () => this.tags,
      (updated) => { this.tags = updated; },
      { placeholder: "Add tag…", addIcon: "tag", chipClass: "kanban-tag-chip" },
    );
  }

  /**
   * Reusable chip input field: displays current items as removable chips with
   * an add-row (text input + icon button) below.
   *
   * Uses getter/setter callbacks so modal state is the single source of truth —
   * the field never holds its own copy of the data.
   *
   * @param getItems  - Returns the current array from modal state.
   * @param setItems  - Persists a new array back to modal state.
   * @param opts.placeholder - Input placeholder text.
   * @param opts.addIcon     - Lucide icon name for the add button.
   * @param opts.chipClass   - Optional extra CSS class for each chip element.
   */
  private renderChipField(
    root: HTMLElement,
    getItems: () => string[],
    setItems: (updated: string[]) => void,
    opts: { placeholder: string; addIcon: string; chipClass?: string },
  ): void {
    const chipsEl = root.createDiv({ cls: "kanban-assignee-chips" });

    const refreshChips = () => {
      chipsEl.empty();
      for (const value of getItems()) {
        const chip = chipsEl.createSpan({
          cls: `kanban-assignee-chip${opts.chipClass ? ` ${opts.chipClass}` : ""}`,
        });
        chip.createSpan({ text: value });
        const removeBtn = chip.createEl("button", {
          cls: "kanban-icon-btn kanban-chip-remove",
          attr: { type: "button", title: "Remove" },
        });
        setIcon(removeBtn, "x");
        removeBtn.addEventListener("click", () => {
          setItems(getItems().filter((v) => v !== value));
          refreshChips();
        });
      }
    };
    refreshChips();

    const addRow = root.createDiv({ cls: "kanban-checklist-add" });
    const input  = addRow.createEl("input", {
      cls:  "kanban-checklist-input",
      attr: { placeholder: opts.placeholder, type: "text" },
    });
    const addBtn = addRow.createEl("button", {
      cls:  "kanban-icon-btn",
      attr: { type: "button", title: "Add" },
    });
    setIcon(addBtn, opts.addIcon);

    const addItem = () => {
      const val = input.value.trim();
      if (!val || getItems().includes(val)) return;
      setItems([...getItems(), val]);
      input.value = "";
      refreshChips();
    };

    addBtn.addEventListener("click", addItem);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addItem(); }
    });
  }

  // ── Checklist ─────────────────────────────────────────────────────────────

  private renderChecklist(root: HTMLElement): void {
    const done  = this.checklist.filter((i) => i.checked).length;
    const total = this.checklist.length;

    const headingSetting = new Setting(root)
      .setName(this.checklistHeadingText(done, total))
      .setHeading();

    // Store reference so updateChecklistProgress() can mutate text directly,
    // avoiding fragile DOM traversal (previousElementSibling chains).
    this.checklistHeadingNameEl = headingSetting.nameEl;

    if (total > 0) {
      const bar = headingSetting.settingEl.createDiv({ cls: "kanban-checklist-bar" });
      this.checklistProgressFillEl = bar.createDiv({ cls: "kanban-checklist-bar-fill" });
      this.checklistProgressFillEl.style.width = `${Math.round((done / total) * 100)}%`;
    }

    this.checklistEl = root.createDiv({ cls: "kanban-checklist-list" });
    this.renderChecklistItems();

    const addRow = root.createDiv({ cls: "kanban-checklist-add" });
    const input  = addRow.createEl("input", {
      cls:  "kanban-checklist-input",
      attr: { placeholder: "Add checklist item…", type: "text" },
    });
    const addBtn = addRow.createEl("button", { cls: "kanban-icon-btn", title: "Add item" });
    setIcon(addBtn, "plus");

    const addItem = () => {
      const text = input.value.trim();
      if (!text) return;
      this.checklist.push({ id: crypto.randomUUID(), text, checked: false });
      input.value = "";
      this.renderChecklistItems();
      this.updateChecklistProgress();
    };

    addBtn.addEventListener("click", addItem);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addItem(); }
    });
  }

  private renderChecklistItems(): void {
    this.checklistEl.empty();
    for (const item of this.checklist) {
      const row = this.checklistEl.createDiv({ cls: "kanban-checklist-item" });

      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = item.checked;
      if (item.checked) row.addClass("kanban-checklist-item--done");

      // Checkbox toggle: update state and progress bar only — no full re-render.
      cb.addEventListener("change", () => {
        item.checked = cb.checked;
        row.toggleClass("kanban-checklist-item--done", item.checked);
        this.updateChecklistProgress();
      });

      const textEl = row.createSpan({
        cls: "kanban-checklist-text",
        text: item.text,
        attr: { title: "Click to edit" },
      });
      textEl.addEventListener("click", () => this.editChecklistItem(item, textEl));

      const delBtn = row.createEl("button", { cls: "kanban-icon-btn kanban-checklist-del", title: "Remove" });
      setIcon(delBtn, "x");
      delBtn.addEventListener("click", () => {
        this.checklist = this.checklist.filter((i) => i.id !== item.id);
        this.renderChecklistItems();
        this.updateChecklistProgress();
      });
    }
  }

  /**
   * Swaps a checklist item's text span for an input, commits on Enter or blur,
   * and reverts on Escape. Empty / whitespace-only values are discarded
   * (the item keeps its original text).
   */
  private editChecklistItem(item: ChecklistItem, textEl: HTMLElement): void {
    const input = createEl("input", {
      cls: "kanban-inline-input kanban-checklist-edit-input",
      value: item.text,
    });
    textEl.replaceWith(input);
    input.focus();
    input.select();

    // Prevents double-commit when Enter triggers blur immediately after.
    let committed = false;

    const commit = () => {
      if (committed) return;
      committed = true;
      const val = input.value.trim();
      if (val) item.text = val;
      this.renderChecklistItems();
    };

    const cancel = () => {
      committed = true;
      this.renderChecklistItems();
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
  }

  /** Updates the heading text and progress bar fill without re-rendering checklist items. */
  private updateChecklistProgress(): void {
    const done  = this.checklist.filter((i) => i.checked).length;
    const total = this.checklist.length;
    if (this.checklistHeadingNameEl) {
      this.checklistHeadingNameEl.textContent = this.checklistHeadingText(done, total);
    }
    if (this.checklistProgressFillEl && total > 0) {
      this.checklistProgressFillEl.style.width = `${Math.round((done / total) * 100)}%`;
    }
  }

  private checklistHeadingText(done: number, total: number): string {
    return total > 0 ? `Checklist (${done}/${total})` : "Checklist";
  }

  // ── Attachments ───────────────────────────────────────────────────────────

  private renderAttachments(root: HTMLElement): void {
    new Setting(root).setName("Links").setHeading();

    this.attachmentsEl = root.createDiv({ cls: "kanban-attachments-list" });
    this.renderAttachmentItems();

    const addRow   = root.createDiv({ cls: "kanban-checklist-add" });
    const browseBtn = addRow.createEl("button", {
      cls:  "kanban-attach-browse-btn",
      text: "Link file…",
      attr: { type: "button" },
    });
    setIcon(browseBtn.createSpan({ cls: "kanban-attach-browse-icon" }), "link");

    browseBtn.addEventListener("click", () => {
      new VaultFileSuggestModal(this.app, (file) => {
        if (this.attachments.includes(file.path)) return;
        this.attachments.push(file.path);
        this.renderAttachmentItems();
      }).open();
    });
  }

  private renderAttachmentItems(): void {
    this.attachmentsEl.empty();
    for (const path of this.attachments) {
      const row = this.attachmentsEl.createDiv({ cls: "kanban-attachment-item" });

      setIcon(row.createSpan({ cls: "kanban-attachment-icon" }), "link");

      const link = row.createEl("button", { cls: "kanban-attachment-link", text: path });
      link.addEventListener("click", () => {
        const file = this.app.vault.getFileByPath(path);
        if (file) {
          void this.app.workspace.getLeaf("tab").openFile(file);
        } else {
          new Notice(`File not found: ${path}`);
        }
      });

      const delBtn = row.createEl("button", { cls: "kanban-icon-btn", title: "Remove" });
      setIcon(delBtn, "x");
      delBtn.addEventListener("click", () => {
        this.attachments = this.attachments.filter((a) => a !== path);
        this.renderAttachmentItems();
      });
    }
  }

  // ── Activity ──────────────────────────────────────────────────────────────

  private renderActivity(root: HTMLElement): void {
    if (!this.existing || this.existing.activity.length === 0) return;

    new Setting(root).setName("Activity").setHeading();

    const list = root.createDiv({ cls: "kanban-activity-list" });
    for (const entry of [...this.existing.activity].reverse()) {
      const row  = list.createDiv({ cls: "kanban-activity-entry" });
      row.createSpan({ cls: `kanban-activity-dot kanban-activity-dot--${entry.action}` });
      const body = row.createDiv({ cls: "kanban-activity-body" });
      body.createSpan({ cls: "kanban-activity-detail", text: entry.detail });
      body.createSpan({ cls: "kanban-activity-time",   text: timeAgo(entry.timestamp) });
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  private renderFooter(root: HTMLElement): void {
    const footer = root.createDiv({ cls: "kanban-modal-footer" });

    if (this.existing) {
      const deleteBtn = footer.createEl("button", { cls: "mod-warning", text: "Delete card" });
      deleteBtn.addEventListener("click", () => {
        // Non-null: button only rendered when this.existing is set.
        this.plugin.store.deleteCard(this.boardId, this.colId, this.existing!.id);
        this.plugin.refreshViews();
        this.close();
      });
    }

    footer.createDiv({ cls: "kanban-modal-footer-spacer" });
    footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());

    footer.createEl("button", { cls: "mod-cta", text: this.existing ? "Save" : "Create" })
      .addEventListener("click", () => this.submit());
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  private submit(): void {
    const title = this.title.trim();
    if (!title) { new Notice("Card title is required."); return; }

    const patch = {
      title,
      description: this.description.trim(),
      tags:        this.tags,
      dueDate:     this.dueDate || undefined,
      assignees:   this.assignees,
      checklist:   this.checklist,
      attachments: this.attachments,
    };

    if (this.existing) {
      this.plugin.store.updateCard(
        this.boardId, this.colId, this.existing.id,
        patch, this.summariseChanges(patch),
      );
    } else {
      this.plugin.store.addCard(this.boardId, this.colId, patch);
    }

    this.plugin.refreshViews();
    this.close();
  }

  private summariseChanges(next: Partial<Card>): string {
    if (!this.existing) return "Updated";
    const changed: string[] = [];
    if (next.title       !== this.existing.title)                                        changed.push("title");
    if (next.description !== this.existing.description)                                  changed.push("description");
    if (next.dueDate     !== this.existing.dueDate)                                      changed.push("due date");
    if (JSON.stringify(next.assignees)   !== JSON.stringify(this.existing.assignees))    changed.push("assignees");
    if (JSON.stringify(next.tags)        !== JSON.stringify(this.existing.tags))         changed.push("tags");
    if (JSON.stringify(next.checklist)   !== JSON.stringify(this.existing.checklist))    changed.push("checklist");
    if (JSON.stringify(next.attachments) !== JSON.stringify(this.existing.attachments))  changed.push("attachments");
    return changed.length > 0 ? `Updated: ${changed.join(", ")}` : "No changes";
  }
}

/** Fuzzy picker for all vault files — used for the Links field. */
class VaultFileSuggestModal extends FuzzySuggestModal<TFile> {
  private readonly onChoose: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Search vault files…");
  }

  getItems(): TFile[]                { return this.app.vault.getFiles(); }
  getItemText(file: TFile): string   { return file.path; }
  onChooseItem(file: TFile): void    { this.onChoose(file); }
}
