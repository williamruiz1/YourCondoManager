/**
 * tests/migration-journal-alignment.test.ts — CI guard for founder-os Issue
 * #2476.
 *
 * Asserts that:
 *   1. Every `.sql` file in `migrations/` is registered in `_journal.json`.
 *   2. Every journal entry has a matching `.sql` file on disk.
 *   3. Journal entries have unique tags + unique idx values.
 *
 * This catches the silent-skip class of failure where a migration is
 * authored, committed, and deployed — but never registered in the journal,
 * so drizzle's migrator skips it. (That class is what caused 0024, 0026,
 * 0028, 0030, 0031, 0032 to be missed in production until the post-mortem.)
 *
 * Run via `npx vitest run tests/migration-journal-alignment.test.ts` or as
 * part of the full server suite.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const MIGRATIONS_DIR = resolve(REPO_ROOT, "migrations");
const JOURNAL_PATH = resolve(MIGRATIONS_DIR, "meta", "_journal.json");

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
  entries: JournalEntry[];
};

const sqlFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => f.replace(/\.sql$/, ""))
  .sort();

const journalTags = journal.entries.map((e) => e.tag);
const journalTagSet = new Set(journalTags);

describe("migration journal alignment (founder-os #2476)", () => {
  it("every .sql file is registered in the journal", () => {
    const missingFromJournal = sqlFiles.filter((tag) => !journalTagSet.has(tag));
    expect(
      missingFromJournal,
      `These migration files are NOT in migrations/meta/_journal.json — they will be silently skipped by drizzle's migrator. ` +
        `Add an entry to _journal.json for each missing migration:\n  ${missingFromJournal.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every journal entry has a matching .sql file", () => {
    const sqlFileSet = new Set(sqlFiles);
    const missingSqlFile = journalTags.filter((tag) => !sqlFileSet.has(tag));
    expect(
      missingSqlFile,
      `These journal entries reference .sql files that don't exist on disk:\n  ${missingSqlFile.join("\n  ")}`,
    ).toEqual([]);
  });

  it("journal tags are unique", () => {
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const tag of journalTags) {
      if (seen.has(tag)) dups.push(tag);
      seen.add(tag);
    }
    expect(dups, `Duplicate journal tags:\n  ${dups.join("\n  ")}`).toEqual([]);
  });

  it("journal idx values are unique", () => {
    const seen = new Set<number>();
    const dups: number[] = [];
    for (const entry of journal.entries) {
      if (seen.has(entry.idx)) dups.push(entry.idx);
      seen.add(entry.idx);
    }
    expect(dups, `Duplicate journal idx values:\n  ${dups.join(", ")}`).toEqual([]);
  });

  it("journal has the same count as .sql files", () => {
    expect(journal.entries.length).toBe(sqlFiles.length);
  });
});
