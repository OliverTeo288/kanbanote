export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export type ActivityAction = "created" | "updated" | "moved" | "checklist" | "attachment";

export interface ActivityEntry {
  id: string;
  timestamp: string;
  action: ActivityAction;
  detail: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  tags: string[];
  dueDate?: string;
  assignees: string[];
  checklist: ChecklistItem[];
  attachments: string[];      // vault-relative file paths
  activity: ActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  title: string;
  cards: Card[];
  color?: string;
}

export interface Board {
  id: string;
  title: string;
  columns: Column[];
  createdAt: string;
  updatedAt: string;
}

export interface KanbanSettings {
  defaultBoardId: string;
  showDueDates: boolean;
  showTags: boolean;
  dataFilePath: string;
}

export const DEFAULT_SETTINGS: KanbanSettings = {
  defaultBoardId: "",
  showDueDates: true,
  showTags: true,
  dataFilePath: "kanban/boards.json",
};

/** Stored in .obsidian/plugins/obsidban/data.json — NOT synced. */
export interface KanbanPluginData {
  settings: KanbanSettings;
}

/** Stored in the vault data file — synced by S3sync. */
export interface KanbanVaultData {
  boards: Board[];
}
