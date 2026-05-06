import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import obsidianmdPkg from "eslint-plugin-obsidianmd";
import security from "eslint-plugin-security";

const obsidianmd = obsidianmdPkg.default ?? obsidianmdPkg;

export default [
  // ── Obsidian plugin conventions ──────────────────────────────────────────
  ...obsidianmd.configs.recommended,

  // ── Security baseline (tuned for Obsidian plugin, not Node.js server) ───
  {
    ...security.configs.recommended,
    rules: {
      // Disable rules that produce false positives for typed bracket-access
      // patterns common in Obsidian plugin DOM / store code.
      "security/detect-object-injection": "off",
      // No filesystem access in this plugin.
      "security/detect-non-literal-fs-filename": "off",
      // Retain the rest of the recommended security rules.
      ...security.configs.recommended.rules,
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },

  // ── TypeScript source rules ───────────────────────────────────────────────
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      security,
    },
    rules: {
      // ── TypeScript type safety ───────────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-base-to-string": "error",
      // Strict — matches the Obsidian community plugin reviewer's config.
      // Catches `async onload()` (Plugin.onload is typed void) and similar
      // mismatches between override signatures and parent types.
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      // ── Code injection prevention ────────────────────────────────────────
      // Blocks eval(), setTimeout("string"), setInterval("string") etc.
      "no-eval": "error",
      "no-implied-eval": "error",
      // Blocks new Function("code") — equivalent to eval.
      "no-new-func": "error",
      // Blocks javascript: URLs.
      "no-script-url": "error",

      // ── DOM safety ────────────────────────────────────────────────────────
      // innerHTML must never receive user-controlled data; prefer Obsidian's
      // createEl / setIcon APIs. Any remaining innerHTML use is intentional
      // (static SVG literals) and should be explicitly suppressed per-line.
      "security/detect-unsafe-regex": "error",
      "security/detect-possible-timing-attacks": "error",

      // ── General correctness ───────────────────────────────────────────────
      "no-control-regex": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "eqeqeq": ["error", "always"],

      // ── Obsidian conventions ──────────────────────────────────────────────
      // Downgraded to warn: proper-noun acronyms (Jira, Trello) produce
      // false positives with this rule.
      "obsidianmd/ui/sentence-case": "warn",
    },
  },

  // ── Ignored paths ────────────────────────────────────────────────────────
  {
    ignores: ["main.js", "node_modules/**", "coverage/**", "scripts/**"],
  },
];
