# Obsidban

A Jira/Trello-style Kanban board as an Obsidian panel view. Organise work into boards, columns, and cards — fully local, no external services.

![CI](https://github.com/OliverTeo288/obsidban/actions/workflows/ci-release.yml/badge.svg)

---

## Features

- **Multiple boards** — create as many boards as you need, switch between them from the header dropdown
- **Columns** — add, rename (double-click the title), reorder (drag the grip handle), and set a colour accent per column
- **Cards** — title, rich description (Write/Preview), tags, due date, assignees, checklist, and vault file links
- **Drag and drop** — move cards between columns or reorder within a column; drag column headers to reorder columns
- **Live search** — filter cards across all columns in real time without leaving the board
- **Multiple assignees** — assign one or more people to a card; shown as initials bubbles on the card face
- **Checklist with progress** — add checklist items with a progress bar; count shown in the heading
- **Links** — attach any vault file to a card via fuzzy search; click to open in a new tab
- **Activity log** — every create, edit, move, and checklist change is timestamped and shown inside the card
- **Overdue indicators** — due dates past today turn red on the card face
- **Settings** — default board, toggle due dates and tags on card faces, custom data file path

### Data storage

Board data is saved to a regular vault file (`kanban/boards.json` by default). Because it is a plain vault file, it is picked up automatically by sync tools like S3sync. Settings (default board, display toggles, data file path) are stored in the plugin's private storage and are **not** synced — they remain device-local.

---

## Installation

This plugin is not yet published to the Obsidian Community Plugins list. Install manually by building from source.

### Prerequisites

- [Node.js 25+](https://nodejs.org/) — verify with `node --version`
- [nvm](https://github.com/nvm-sh/nvm) (recommended) — run `nvm use` in the repo root to switch automatically

### 1 — Clone and build

```bash
git clone https://github.com/OliverTeo288/obsidban.git
cd obsidban
npm install
npm run build
```

This produces `main.js`, `manifest.json`, and `styles.css` in the repo root.

### 2 — Copy files into your vault

**Option A — deploy script (recommended)**

```bash
./scripts/deploy-local.sh /path/to/your/vault
```

Vault path resolution order if you omit the argument:
1. `OBSIDIAN_VAULT` environment variable
2. Auto-detect: first directory under `~/Documents` that contains `.obsidian/`

**Option B — manual copy**

```bash
VAULT="/path/to/your/vault"
mkdir -p "$VAULT/.obsidian/plugins/obsidban"
cp main.js manifest.json styles.css "$VAULT/.obsidian/plugins/obsidban/"
```

### 3 — Enable in Obsidian

1. Open **Settings → Community plugins**
2. If you see a **Safe mode** banner, click **Turn on community plugins**
3. Under **Installed plugins**, find **Obsidban** and toggle it **on**
4. Close settings — the Kanban board ribbon icon appears in the left sidebar

> **Plugin not showing up?**
> - Confirm the three files exist at `<vault>/.obsidian/plugins/obsidban/`
> - Restart Obsidian, then check **Settings → Community plugins → Installed plugins**
> - On macOS, if the vault is in iCloud Drive, wait for files to finish syncing before restarting

---

## Install via BRAT

You can also install directly from this repo using [BRAT](https://github.com/TfTHacker/obsidian42-brat) (no manual build needed):

1. Install and enable the BRAT plugin from Community Plugins
2. Run **BRAT: Add a beta plugin** from the command palette
3. Enter: `OliverTeo288/obsidban`

---

## How to use

### Opening the board

- Click the **grid icon** in the left ribbon
- Run **Obsidban: Open board** from the command palette (`Cmd/Ctrl + P`)

### Creating your first board

1. Click **+ New board** in the board header, or run **Obsidban: Create new board** from the command palette
2. Enter a board name and click **Create**
3. Three columns are created automatically: **To Do**, **In Progress**, **Done**

---

### Boards

| Action | How |
|---|---|
| Switch board | Use the dropdown in the top-left of the board header |
| Search cards | Type in the search bar — all columns filter in real time |
| Rename board | Click **⋮** (board options) → **Rename board** |
| Add column | Click **⋮** → **Add column**, or click **+ Add column** at the right edge of the board |
| Delete board | Click **⋮** → **Delete board** |

### Columns

| Action | How |
|---|---|
| Rename column | Double-click the column title, type, then press `Enter` or click away |
| Reorder column | Drag the grip handle (`⠿`) in the column header |
| Set column colour | Click **⋮** (column options) → **Change color** — choose a preset or use the colour picker |
| Add card | Click **+** in the column header |
| Delete column | Click **⋮** → **Delete column** — only available when the column is empty |

### Cards

| Action | How |
|---|---|
| Create card | Click **+** in a column header |
| Edit card | Click any card to open the edit modal |
| Move card | Drag to any column, or drop onto a specific card to insert before it |
| Delete card | Open the card → **Delete card**, or right-click → **Delete card** |

#### Card fields

| Field | Notes |
|---|---|
| **Title** | Required. Displayed on the card face. |
| **Description** | Markdown supported. Use the **Write** tab to edit, **Preview** tab to render. |
| **Assignees** | Add one or more names. Shown as initials bubbles on the card face (first 2 visible, overflow as `+N`). |
| **Due date** | Date picker. Turns red on the card face when past today. |
| **Tags** | Add individual tags as chips. Shown as coloured pills on the card face (requires **Show tags** setting). |
| **Checklist** | Add items with a progress bar. Count shown as `done/total` in the section heading. |
| **Links** | Attach vault files via fuzzy search. Click a link to open the file in a new tab. Shown as a link-count badge on the card face. |

### Settings

**Settings → Obsidban**

| Setting | Description |
|---|---|
| Board data file | Vault-relative path for `boards.json`. Change this to move your data file. Reload the plugin after changing. |
| Default board | Which board opens when you first open the view |
| Show due dates on cards | Toggle due date display on card faces |
| Show tags on cards | Toggle tag pill display on card faces |

---

## Development

### Setup

```bash
git clone https://github.com/OliverTeo288/obsidban.git
cd obsidban
nvm use          # switches to Node 25 via .nvmrc
npm install
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Watch mode — rebuilds on every save |
| `npm run build` | Production build (minified bundle) |
| `npm run typecheck` | TypeScript type-check only, no bundle |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run audit` | `npm audit --audit-level=high` |
| `npm run validate` | typecheck + lint + audit (run before committing) |
| `./scripts/deploy-local.sh` | Build + copy artefacts into a local vault |

### Project structure

```
src/
├── main.ts          Plugin entry — registers view, commands, settings tab, persistence, migration
├── types.ts         Board / Column / Card / ChecklistItem / ActivityEntry / KanbanSettings interfaces
├── store.ts         BoardStore — in-memory CRUD with activity logging; triggers persist on every mutation
├── utils.ts         nanoid, formatDate, isOverdue, timeAgo, isSafeVaultPath, isSafeColor, FOCUS_DELAY_MS
└── ui/
    ├── boardView.ts  KanbanBoardView (ItemView) — board/column/card rendering, DnD, live search
    ├── boardModal.ts NewBoard / RenameBoard / AddColumn / SetColumnColor / Confirm modals
    ├── cardModal.ts  Create / edit card modal — chip fields, checklist, attachments, activity log
    └── settings.ts   Settings tab
```

### CI / CD

Two GitHub Actions workflows run on every push:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci-release.yml` | Push / PR / semver tag | ESLint with PR annotations, TypeScript type-check, production build. On a semver tag (`1.2.3`): stamps versions, creates a GitHub Release, attaches `main.js`, `manifest.json`, `styles.css`. |
| `dependency-scan.yml` | Daily 02:00 UTC / push to main | `npm audit` (HIGH+CRITICAL), Trivy vulnerability + secret + licence scans. |

**To release a new version:**

```bash
git tag 1.2.0
git push origin 1.2.0
```

No `v` prefix on tags.

---

## Roadmap

- [ ] Mobile drag and drop (touch events)
- [ ] Archive / hide column (without deleting cards)
- [ ] Card cover images
- [ ] Board-level labels / swimlanes

---

## License

[MIT](LICENSE) © 2025 Oliver Teo
