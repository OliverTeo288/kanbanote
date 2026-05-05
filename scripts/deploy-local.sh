#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-local.sh
#
# Build the plugin and copy artefacts into a local Obsidian vault for
# development testing — no GitHub release needed.
#
# Usage:
#   ./scripts/deploy-local.sh [/path/to/vault]
#
# Vault resolution order:
#   1. First CLI argument
#   2. OBSIDIAN_VAULT env var
#   3. Auto-detect: first directory under ~/Documents that contains .obsidian/
#
# Examples:
#   ./scripts/deploy-local.sh ~/Documents/MyVault
#   OBSIDIAN_VAULT=~/Documents/MyVault ./scripts/deploy-local.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PLUGIN_ID=$(node -e "process.stdout.write(require('./manifest.json').id)")
PLUGIN_NAME=$(node -e "process.stdout.write(require('./manifest.json').name)")

# ── Resolve vault path ────────────────────────────────────────────────────────

VAULT="${1:-${OBSIDIAN_VAULT:-}}"

if [[ -z "$VAULT" ]]; then
  VAULT=$(find ~/Documents -maxdepth 2 -name ".obsidian" -type d 2>/dev/null \
            | head -1 | xargs dirname 2>/dev/null || true)
fi

if [[ -z "$VAULT" || ! -d "$VAULT" ]]; then
  echo "❌  Could not find an Obsidian vault."
  echo "    Pass the vault path as the first argument or set OBSIDIAN_VAULT."
  exit 1
fi

PLUGIN_DIR="$VAULT/.obsidian/plugins/$PLUGIN_ID"

echo "📦  Vault  : $VAULT"
echo "🔌  Plugin : $PLUGIN_NAME ($PLUGIN_ID)"
echo "📂  Target : $PLUGIN_DIR"
echo ""

# ── Dependencies ──────────────────────────────────────────────────────────────

if [[ ! -d node_modules ]]; then
  echo "📥  Installing dependencies…"
  npm install --prefer-offline 2>&1 | tail -1
  echo ""
fi

# ── Build ─────────────────────────────────────────────────────────────────────

echo "🔨  Building…"
npm run build
echo ""

# ── Deploy ────────────────────────────────────────────────────────────────────

mkdir -p "$PLUGIN_DIR"

ARTEFACTS=(main.js manifest.json styles.css)

for f in "${ARTEFACTS[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "❌  Missing artefact: $f  (did the build fail?)"
    exit 1
  fi
  cp "$f" "$PLUGIN_DIR/$f"
done

echo "✅  Deployed to $PLUGIN_DIR"
echo ""
echo "   Files copied:"
for f in "${ARTEFACTS[@]}"; do
  SIZE=$(du -h "$PLUGIN_DIR/$f" | cut -f1)
  echo "   · $f  ($SIZE)"
done
echo ""
echo "💡  Reload the plugin in Obsidian:"
echo "    Settings → Community Plugins → $PLUGIN_NAME → Disable → Enable"
echo "    Or toggle it via the BRAT plugin."
