import { ItemView, Menu, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type KanbanPlugin from "../main";
import type { Board, Card, Column } from "../types";
import { isSafeColor } from "../utils";
import { CardModal } from "./cardModal";
import { AddColumnModal, ConfirmModal, NewBoardModal, RenameBoardModal, SetColumnColorModal } from "./boardModal";

export const KANBAN_VIEW_TYPE = "kanban-board";

interface CardDragState {
  cardId: string;
  fromColId: string;
  boardId: string;
}

interface ColDragState {
  colId: string;
  boardId: string;
}

export class KanbanBoardView extends ItemView {
  private plugin: KanbanPlugin;
  private activeBoardId: string;
  private cardDrag: CardDragState | null = null;
  private colDrag: ColDragState | null = null;
  private searchQuery = "";

  constructor(leaf: WorkspaceLeaf, plugin: KanbanPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.activeBoardId = plugin.settings.defaultBoardId;
  }

  getViewType(): string    { return KANBAN_VIEW_TYPE; }
  getDisplayText(): string { return "Kanban board"; }
  getIcon(): string        { return "table-2"; }

  async onOpen(): Promise<void>  { this.render(); }
  async onClose(): Promise<void> { /* nothing to tear down */ }

  // ── Render entry ─────────────────────────────────────────────────────────

  render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("kanban-root");

    const boards = this.plugin.store.getBoards();
    if (boards.length === 0) {
      this.renderEmpty(root);
      return;
    }

    const board = this.resolveActiveBoard(boards);
    this.renderHeader(root, boards, board);
    this.renderBoard(root, board);
    if (this.searchQuery) this.applySearch(root);
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  private renderEmpty(root: HTMLElement): void {
    const wrap = root.createDiv({ cls: "kanban-empty" });
    wrap.createEl("p", { text: "No boards yet. Create one to get started." });
    wrap.createEl("button", { cls: "mod-cta", text: "Create board" })
      .addEventListener("click", () => new NewBoardModal(this.app, this.plugin).open());
  }

  // ── Header ───────────────────────────────────────────────────────────────

  private renderHeader(root: HTMLElement, boards: Board[], active: Board): void {
    const header = root.createDiv({ cls: "kanban-header" });

    const selector = header.createEl("select", { cls: "kanban-board-select" });
    for (const b of boards) {
      const opt = selector.createEl("option", { text: b.title, value: b.id });
      if (b.id === active.id) opt.selected = true;
    }
    selector.addEventListener("change", () => {
      this.activeBoardId = selector.value;
      this.searchQuery   = "";
      this.render();
    });

    const searchWrap = header.createDiv({ cls: "kanban-search-wrap" });
    setIcon(searchWrap.createSpan({ cls: "kanban-search-icon" }), "search");
    const searchInput = searchWrap.createEl("input", {
      cls:  "kanban-search-input",
      attr: { placeholder: "Search cards…", type: "text" },
    });
    if (this.searchQuery) searchInput.value = this.searchQuery;
    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value;
      this.applySearch(root);
    });

    const actions    = header.createDiv({ cls: "kanban-header-actions" });
    const newBoardBtn = actions.createEl("button", { cls: "kanban-icon-btn kanban-new-board-btn", title: "New board" });
    setIcon(newBoardBtn, "plus");
    newBoardBtn.createSpan({ text: "New board" });
    newBoardBtn.addEventListener("click", () => new NewBoardModal(this.app, this.plugin).open());

    const moreBtn = actions.createEl("button", { cls: "kanban-icon-btn", title: "Board options" });
    setIcon(moreBtn, "more-vertical");
    moreBtn.addEventListener("click", (e) => this.showBoardMenu(e, active));
  }

  /**
   * Filters visible cards by toggling their display without triggering a full re-render.
   * Manages a "no matching cards" placeholder per column.
   */
  private applySearch(root: HTMLElement): void {
    const q = this.searchQuery.toLowerCase().trim();

    root.querySelectorAll<HTMLElement>(".kanban-column").forEach((colEl) => {
      let visibleCount = 0;

      colEl.querySelectorAll<HTMLElement>(".kanban-card").forEach((cardEl) => {
        const matches = !q || (cardEl.dataset.search ?? "").includes(q);
        cardEl.toggle(matches);
        if (matches) visibleCount++;
      });

      // Create the placeholder once; reuse and show/hide on subsequent calls.
      const cardsEl = colEl.querySelector<HTMLElement>(".kanban-cards");
      if (!cardsEl) return;

      let noResults = cardsEl.querySelector<HTMLElement>(".kanban-no-results");
      if (!noResults) {
        noResults = cardsEl.createDiv({ cls: "kanban-no-results", text: "No matching cards" });
      }
      noResults.toggle(q.length > 0 && visibleCount === 0);
    });
  }

  private showBoardMenu(e: MouseEvent, board: Board): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle("Rename board").setIcon("pencil").onClick(() => {
        new RenameBoardModal(this.app, this.plugin, board).open();
      })
    );
    menu.addItem((item) =>
      item.setTitle("Add column").setIcon("columns").onClick(() => {
        this.promptAddColumn(board.id);
      })
    );
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Delete board").setIcon("trash").onClick(() => {
        this.confirmDeleteBoard(board);
      })
    );
    menu.showAtMouseEvent(e);
  }

  // ── Board ────────────────────────────────────────────────────────────────

  private renderBoard(root: HTMLElement, board: Board): void {
    const boardEl = root.createDiv({ cls: "kanban-board" });
    for (const col of board.columns) {
      this.renderColumn(boardEl, board.id, col);
    }
    boardEl.createDiv({ cls: "kanban-add-column-btn" })
      .createSpan({ text: "+ Add column" });
    boardEl.querySelector<HTMLElement>(".kanban-add-column-btn")
      ?.addEventListener("click", () => this.promptAddColumn(board.id));
  }

  // ── Column ───────────────────────────────────────────────────────────────

  private renderColumn(boardEl: HTMLElement, boardId: string, col: Column): void {
    const colEl = boardEl.createDiv({ cls: "kanban-column" });
    this.attachColumnDropHandlers(colEl, boardId, col);

    const colHeader = colEl.createDiv({ cls: "kanban-column-header", attr: { draggable: "true" } });
    // MEDIUM-4: validate color from vault JSON before injecting into style.
    if (col.color && isSafeColor(col.color)) colHeader.style.borderTopColor = col.color;

    colHeader.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      this.colDrag  = { colId: col.id, boardId };
      this.cardDrag = null;
      colEl.addClass("kanban-column-dragging");
    });
    colHeader.addEventListener("dragend", () => {
      this.colDrag = null;
      colEl.removeClass("kanban-column-dragging");
    });

    const titleWrap  = colHeader.createDiv({ cls: "kanban-column-title-wrap" });
    const dragHandle = titleWrap.createSpan({ cls: "kanban-column-drag-handle", title: "Drag to reorder" });
    setIcon(dragHandle, "grip-vertical");

    const titleEl = titleWrap.createSpan({ cls: "kanban-column-title", text: col.title });
    const countEl = titleWrap.createSpan({ cls: "kanban-column-count", text: String(col.cards.length) });
    titleEl.addEventListener("dblclick", () => {
      this.inlineRenameColumn(boardId, col, titleEl, countEl);
    });

    const colActions = colHeader.createDiv({ cls: "kanban-column-actions" });

    const addCardBtn = colActions.createEl("button", { cls: "kanban-icon-btn", title: "Add card" });
    setIcon(addCardBtn, "plus");
    addCardBtn.addEventListener("click", () => {
      new CardModal(this.app, this.plugin, boardId, col.id, null).open();
    });

    const moreColBtn = colActions.createEl("button", { cls: "kanban-icon-btn", title: "Column options" });
    setIcon(moreColBtn, "more-vertical");
    moreColBtn.addEventListener("click", (e) => this.showColumnMenu(e, boardId, col));

    const cardsList = colEl.createDiv({ cls: "kanban-cards" });
    for (const card of col.cards) {
      this.renderCard(cardsList, boardId, col.id, card);
    }
  }

  /**
   * Attaches all drag-and-drop handlers to a column element.
   * Handles both card-drop-into-column and column-reorder interactions.
   */
  private attachColumnDropHandlers(colEl: HTMLElement, boardId: string, col: Column): void {
    colEl.addEventListener("dragover", (e) => {
      if (this.colDrag?.boardId === boardId && this.colDrag.colId !== col.id) {
        e.preventDefault();
        colEl.addClass("kanban-column-drop-target");
      } else if (this.cardDrag?.boardId === boardId) {
        e.preventDefault();
        colEl.addClass("kanban-drag-over");
      }
    });

    colEl.addEventListener("dragleave", () => {
      colEl.removeClass("kanban-drag-over", "kanban-column-drop-target");
    });

    colEl.addEventListener("drop", (e) => {
      e.preventDefault();
      colEl.removeClass("kanban-drag-over", "kanban-column-drop-target");

      if (this.colDrag?.boardId === boardId && this.colDrag.colId !== col.id) {
        this.plugin.store.moveColumn(boardId, this.colDrag.colId, col.id);
        this.colDrag = null;
        this.render();
        return;
      }
      if (this.cardDrag?.boardId === boardId) {
        this.plugin.store.moveCard(boardId, this.cardDrag.fromColId, this.cardDrag.cardId, col.id, -1);
        this.cardDrag = null;
        this.render();
      }
    });
  }

  // ── Card ─────────────────────────────────────────────────────────────────

  private renderCard(cardsList: HTMLElement, boardId: string, colId: string, card: Card): void {
    const cardEl = cardsList.createDiv({ cls: "kanban-card", attr: { draggable: "true" } });
    // Searchable text stored as a data attribute — applySearch() reads this without re-rendering.
    cardEl.dataset.search = [card.title, card.description, ...card.tags, ...card.assignees]
      .join(" ").toLowerCase();

    this.attachCardDragHandlers(cardEl, boardId, colId, card);

    cardEl.addEventListener("click", () => {
      new CardModal(this.app, this.plugin, boardId, colId, card).open();
    });

    this.renderCardContent(cardEl, card);
    this.attachCardContextMenu(cardEl, boardId, colId, card);
  }

  /** Attaches all drag-and-drop handlers to a card element. */
  private attachCardDragHandlers(cardEl: HTMLElement, boardId: string, colId: string, card: Card): void {
    cardEl.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      this.cardDrag = { cardId: card.id, fromColId: colId, boardId };
      this.colDrag  = null;
      cardEl.addClass("kanban-card-dragging");
    });
    cardEl.addEventListener("dragend", () => {
      this.cardDrag = null;
      cardEl.removeClass("kanban-card-dragging");
    });
    cardEl.addEventListener("dragover", (e) => {
      if (!this.cardDrag) return;
      e.preventDefault();
      e.stopPropagation();
      cardEl.addClass("kanban-card-drop-above");
    });
    cardEl.addEventListener("dragleave", () => {
      cardEl.removeClass("kanban-card-drop-above");
    });
    cardEl.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      cardEl.removeClass("kanban-card-drop-above");
      if (!this.cardDrag || this.cardDrag.boardId !== boardId || this.cardDrag.cardId === card.id) return;
      const targetIdx = this.plugin.store
        .getBoard(boardId)
        ?.columns.find((c) => c.id === colId)
        ?.cards.findIndex((c) => c.id === card.id) ?? -1;
      this.plugin.store.moveCard(boardId, this.cardDrag.fromColId, this.cardDrag.cardId, colId, targetIdx);
      this.cardDrag = null;
      this.render();
    });
  }

  /** Renders the visible card body: title, tags, due date, and meta badges. */
  private renderCardContent(cardEl: HTMLElement, card: Card): void {
    cardEl.createSpan({ cls: "kanban-card-title", text: card.title });

    if (this.plugin.settings.showTags && card.tags.length > 0) {
      const tagsEl = cardEl.createDiv({ cls: "kanban-card-tags" });
      for (const tag of card.tags) {
        tagsEl.createSpan({ cls: "kanban-tag", text: tag });
      }
    }

    if (this.plugin.settings.showDueDates && card.dueDate) {
      const due   = new Date(card.dueDate);
      const today = new Date(new Date().toDateString());
      cardEl.createSpan({
        cls:  `kanban-card-due${due < today ? " kanban-card-due--overdue" : ""}`,
        text: due.toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
      });
    }

    this.renderCardBadges(cardEl, card);
  }

  /** Renders the assignee bubbles, checklist badge, and link badge in the card footer. */
  private renderCardBadges(cardEl: HTMLElement, card: Card): void {
    const hasMeta = card.checklist.length > 0 || card.assignees.length > 0 || card.attachments.length > 0;
    if (!hasMeta) return;

    const meta = cardEl.createDiv({ cls: "kanban-card-meta" });

    if (card.assignees.length > 0) {
      const visible  = card.assignees.slice(0, 2);
      const overflow = card.assignees.length - visible.length;
      for (const name of visible) {
        const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
        meta.createSpan({ cls: "kanban-card-assignee", text: initials, attr: { title: name } });
      }
      if (overflow > 0) {
        meta.createSpan({
          cls:  "kanban-card-assignee kanban-card-assignee--overflow",
          text: `+${overflow}`,
          attr: { title: card.assignees.slice(2).join(", ") },
        });
      }
    }

    if (card.checklist.length > 0) {
      const done  = card.checklist.filter((i) => i.checked).length;
      const total = card.checklist.length;
      const badge = meta.createSpan({
        cls:  `kanban-card-checklist-badge${done === total ? " kanban-card-checklist-badge--done" : ""}`,
        attr: { title: `Checklist: ${done}/${total}` },
      });
      setIcon(badge.createSpan({ cls: "kanban-card-checklist-icon" }), "check-square");
      badge.createSpan({ text: `${done}/${total}` });
    }

    if (card.attachments.length > 0) {
      const badge = meta.createSpan({
        cls:  "kanban-card-attach-badge",
        attr: { title: `${card.attachments.length} link(s)` },
      });
      setIcon(badge.createSpan({ cls: "kanban-card-attach-icon" }), "link");
      badge.createSpan({ text: String(card.attachments.length) });
    }
  }

  /** Registers the right-click context menu on a card element. */
  private attachCardContextMenu(cardEl: HTMLElement, boardId: string, colId: string, card: Card): void {
    this.registerDomEvent(cardEl, "contextmenu", (e: MouseEvent) => {
      e.preventDefault();
      const menu = new Menu();
      menu.addItem((item) =>
        item.setTitle("Edit card").setIcon("pencil").onClick(() => {
          new CardModal(this.app, this.plugin, boardId, colId, card).open();
        })
      );
      menu.addSeparator();
      menu.addItem((item) =>
        item.setTitle("Delete card").setIcon("trash").onClick(() => {
          this.plugin.store.deleteCard(boardId, colId, card.id);
          this.render();
        })
      );
      menu.showAtMouseEvent(e);
    });
  }

  // ── Column helpers ────────────────────────────────────────────────────────

  private inlineRenameColumn(boardId: string, col: Column, titleEl: HTMLElement, countEl: HTMLElement): void {
    const input = createEl("input", { cls: "kanban-inline-input", value: col.title });
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const val = input.value.trim();
      if (val && val !== col.title) {
        this.plugin.store.renameColumn(boardId, col.id, val);
        const updated = this.plugin.store.getBoard(boardId)?.columns.find((c) => c.id === col.id);
        countEl.setText(String(updated?.cards.length ?? 0));
      }
      this.render();
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  { commit(); }
      if (e.key === "Escape") { this.render(); }
    });
  }

  private promptAddColumn(boardId: string): void {
    new AddColumnModal(this.app, this.plugin, boardId).open();
  }

  private showColumnMenu(e: MouseEvent, boardId: string, col: Column): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle("Add card").setIcon("plus").onClick(() => {
        new CardModal(this.app, this.plugin, boardId, col.id, null).open();
      })
    );
    menu.addItem((item) =>
      item.setTitle("Change color").setIcon("palette").onClick(() => {
        new SetColumnColorModal(this.app, this.plugin, boardId, col).open();
      })
    );
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Delete column").setIcon("trash").onClick(() => {
        if (col.cards.length > 0) {
          new Notice(`Cannot delete "${col.title}" — move or delete its cards first.`);
          return;
        }
        this.plugin.store.deleteColumn(boardId, col.id);
        this.render();
      })
    );
    menu.showAtMouseEvent(e);
  }

  // ── Board helpers ─────────────────────────────────────────────────────────

  private confirmDeleteBoard(board: Board): void {
    new ConfirmModal(
      this.app,
      `Delete board "${board.title}"? This cannot be undone.`,
      () => {
        this.plugin.store.deleteBoard(board.id);
        if (this.activeBoardId === board.id) {
          this.activeBoardId = this.plugin.store.getBoards()[0]?.id ?? "";
        }
        this.render();
      },
    ).open();
  }

  private resolveActiveBoard(boards: Board[]): Board {
    return (
      this.plugin.store.getBoard(this.activeBoardId) ??
      this.plugin.store.getBoard(this.plugin.settings.defaultBoardId) ??
      boards[0]
    );
  }
}
