import { nanoid } from "./utils";
import type { ActivityEntry, Board, Card, Column } from "./types";

export class BoardStore {
  private boards: Board[];
  private onChange: () => void;

  constructor(boards: Board[], onChange: () => void) {
    this.boards = boards;
    this.onChange = onChange;
  }

  // ── Boards ────────────────────────────────────────────────────────────────

  getBoards(): Board[] { return this.boards; }

  getBoard(id: string): Board | undefined {
    return this.boards.find((b) => b.id === id);
  }

  createBoard(title: string): Board {
    const now = new Date().toISOString();
    const board: Board = { id: nanoid(), title: title.trim(), columns: [], createdAt: now, updatedAt: now };
    this.boards.push(board);
    this.onChange();
    return board;
  }

  renameBoard(boardId: string, title: string): void {
    const board = this.requireBoard(boardId);
    board.title = title.trim();
    board.updatedAt = new Date().toISOString();
    this.onChange();
  }

  deleteBoard(boardId: string): void {
    this.boards = this.boards.filter((b) => b.id !== boardId);
    this.onChange();
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  addColumn(boardId: string, title: string, color?: string): Column {
    const board = this.requireBoard(boardId);
    const column: Column = { id: nanoid(), title: title.trim(), cards: [], color };
    board.columns.push(column);
    board.updatedAt = new Date().toISOString();
    this.onChange();
    return column;
  }

  renameColumn(boardId: string, columnId: string, title: string): void {
    const col = this.requireColumn(boardId, columnId);
    col.title = title.trim();
    this.requireBoard(boardId).updatedAt = new Date().toISOString();
    this.onChange();
  }

  setColumnColor(boardId: string, columnId: string, color: string): void {
    const col = this.requireColumn(boardId, columnId);
    col.color = color || undefined;
    this.requireBoard(boardId).updatedAt = new Date().toISOString();
    this.onChange();
  }

  deleteColumn(boardId: string, columnId: string): void {
    const board = this.requireBoard(boardId);
    board.columns = board.columns.filter((c) => c.id !== columnId);
    board.updatedAt = new Date().toISOString();
    this.onChange();
  }

  moveColumn(boardId: string, fromColId: string, toColId: string): void {
    const board = this.requireBoard(boardId);
    const fromIdx = board.columns.findIndex((c) => c.id === fromColId);
    const toIdx = board.columns.findIndex((c) => c.id === toColId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [col] = board.columns.splice(fromIdx, 1);
    board.columns.splice(toIdx, 0, col);
    board.updatedAt = new Date().toISOString();
    this.onChange();
  }

  // ── Cards ─────────────────────────────────────────────────────────────────

  addCard(boardId: string, columnId: string, data: Omit<Card, "id" | "activity" | "createdAt" | "updatedAt">): Card {
    const col = this.requireColumn(boardId, columnId);
    const now = new Date().toISOString();
    const card: Card = {
      ...data,
      id: nanoid(),
      activity: [makeActivity("created", "Card created")],
      createdAt: now,
      updatedAt: now,
    };
    col.cards.push(card);
    this.requireBoard(boardId).updatedAt = now;
    this.onChange();
    return card;
  }

  updateCard(
    boardId: string,
    columnId: string,
    cardId: string,
    patch: Partial<Omit<Card, "id" | "createdAt" | "activity">>,
    activityDetail: string,
  ): void {
    const card = this.requireCard(boardId, columnId, cardId);
    const now = new Date().toISOString();
    Object.assign(card, patch, { updatedAt: now });
    card.activity.push(makeActivity("updated", activityDetail));
    this.requireBoard(boardId).updatedAt = now;
    this.onChange();
  }

  deleteCard(boardId: string, columnId: string, cardId: string): void {
    const col = this.requireColumn(boardId, columnId);
    col.cards = col.cards.filter((c) => c.id !== cardId);
    this.requireBoard(boardId).updatedAt = new Date().toISOString();
    this.onChange();
  }

  moveCard(boardId: string, fromColId: string, cardId: string, toColId: string, toIndex: number): void {
    const fromCol = this.requireColumn(boardId, fromColId);
    const cardIdx = fromCol.cards.findIndex((c) => c.id === cardId);
    if (cardIdx === -1) return;

    const [card] = fromCol.cards.splice(cardIdx, 1);
    const toCol = this.requireColumn(boardId, toColId);

    if (toIndex === -1 || toIndex >= toCol.cards.length) {
      toCol.cards.push(card);
    } else {
      toCol.cards.splice(toIndex, 0, card);
    }

    if (fromColId !== toColId) {
      card.activity.push(makeActivity("moved", `Moved to "${toCol.title}"`));
    }

    card.updatedAt = new Date().toISOString();
    this.requireBoard(boardId).updatedAt = new Date().toISOString();
    this.onChange();
  }

  // Note: per-checklist-item and per-attachment mutations are intentionally
  // not exposed. The card modal manages those in local state and persists the
  // full card via updateCard() on Save — keeping the store API minimal.

  // ── Internal helpers ──────────────────────────────────────────────────────

  private requireBoard(boardId: string): Board {
    const board = this.getBoard(boardId);
    if (!board) throw new Error(`Board not found: ${boardId}`);
    return board;
  }

  private requireColumn(boardId: string, columnId: string): Column {
    const col = this.requireBoard(boardId).columns.find((c) => c.id === columnId);
    if (!col) throw new Error(`Column not found: ${columnId}`);
    return col;
  }

  private requireCard(boardId: string, columnId: string, cardId: string): Card {
    const card = this.requireColumn(boardId, columnId).cards.find((c) => c.id === cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);
    return card;
  }
}

function makeActivity(action: ActivityEntry["action"], detail: string): ActivityEntry {
  return { id: nanoid(), timestamp: new Date().toISOString(), action, detail };
}
