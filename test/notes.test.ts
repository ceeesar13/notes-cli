import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, formatList, formatMarkdown, NotesError, type Note } from "../src/notes.ts";

const DAY = "2026-11-06";
const tmpFile = () => join(mkdtempSync(join(tmpdir(), "notes-")), "notes.json");

describe("notes", () => {
  it("adds a note with the next id", () => {
    const notes = addNote(addNote([], "first", DAY), "second", DAY);
    expect(notes.map((n) => n.id)).toEqual([1, 2]);
  });

  it("trims text and refuses empty notes", () => {
    expect(addNote([], "  hi  ", DAY)[0].text).toBe("hi");
    expect(() => addNote([], "   ", DAY)).toThrow(NotesError);
  });

  it("deletes by id and refuses unknown ids", () => {
    const notes: Note[] = addNote([], "a", DAY);
    expect(deleteNote(notes, 1)).toEqual([]);
    expect(() => deleteNote(notes, 9)).toThrow("no note with id 9");
  });

  it("formats a list", () => {
    expect(formatList([])).toBe("No notes yet.");
    expect(formatList(addNote([], "milk", DAY))).toBe("1. milk (2026-11-06)");
  });
});

describe("formatMarkdown", () => {
  const mk = (id: number, text: string): Note => ({ id, text, created: "2026-11-11" });

  it("prints one note as a checklist line", () => {
    expect(formatMarkdown([mk(1, "comprar leche")])).toBe("- [ ] comprar leche (2026-11-11)");
  });

  it("orders by id even when input is out of order", () => {
    expect(formatMarkdown([mk(3, "c"), mk(1, "a"), mk(2, "b")])).toBe(
      "- [ ] a (2026-11-11)\n- [ ] b (2026-11-11)\n- [ ] c (2026-11-11)",
    );
  });

  it("returns the empty message for no notes", () => {
    expect(formatMarkdown([])).toBe("No notes yet.");
  });

  it("does not mutate its input", () => {
    const input = [mk(3, "c"), mk(1, "a")];
    formatMarkdown(input);
    expect(input.map((n) => n.id)).toEqual([3, 1]);
  });
});

describe("cli export", () => {
  it("prints the checklist with code 0", () => {
    const file = tmpFile();
    run(["add", "one"], file, DAY);
    run(["add", "two"], file, DAY);
    expect(run(["export"], file, DAY)).toEqual({
      code: 0,
      out: "- [ ] one (2026-11-06)\n- [ ] two (2026-11-06)",
    });
  });

  it("prints the empty message when there are no notes", () => {
    expect(run(["export"], tmpFile(), DAY)).toEqual({ code: 0, out: "No notes yet." });
  });

  it("leaves the notes file byte-identical", () => {
    const file = tmpFile();
    run(["add", "one"], file, DAY);
    const before = readFileSync(file);
    run(["export"], file, DAY);
    expect(readFileSync(file).equals(before)).toBe(true);
  });

  it("does not create a file when none exists", () => {
    const file = tmpFile();
    run(["export"], file, DAY);
    expect(existsSync(file)).toBe(false);
  });

  it("keeps list, add, delete and usage behaviour", () => {
    const file = tmpFile();
    expect(run(["add", "x"], file, DAY)).toEqual({ code: 0, out: "Added note 1." });
    expect(run(["list"], file, DAY).out).toBe("1. x (2026-11-06)");
    expect(run(["delete", "1"], file, DAY)).toEqual({ code: 0, out: "Deleted note 1." });
    expect(run(["fly"], file, DAY)).toEqual({
      code: 2,
      out: "usage: notes add <text> | notes list | notes delete <id> | notes export",
    });
  });
});

describe("cli", () => {
  it("adds and lists notes in the file", () => {
    const file = tmpFile();
    expect(run(["add", "buy", "milk"], file, DAY)).toEqual({ code: 0, out: "Added note 1." });
    expect(run(["list"], file, DAY).out).toBe("1. buy milk (2026-11-06)");
  });

  it("deletes a note", () => {
    const file = tmpFile();
    run(["add", "x"], file, DAY);
    expect(run(["delete", "1"], file, DAY).code).toBe(0);
    expect(run(["list"], file, DAY).out).toBe("No notes yet.");
  });

  it("reports errors with exit code 1", () => {
    const file = tmpFile();
    writeFileSync(file, "{ not json");
    expect(run(["list"], file, DAY).code).toBe(1);
    expect(run(["delete", "3"], tmpFile(), DAY)).toEqual({ code: 1, out: "error: no note with id 3" });
  });

  it("prints usage for unknown commands", () => {
    expect(run(["fly"], tmpFile(), DAY).code).toBe(2);
  });
});
