import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, formatList, formatListColor, NotesError, type Note } from "../src/notes.ts";

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

describe("formatListColor", () => {
  it("colours id grey and text green", () => {
    const notes: Note[] = [{ id: 1, text: "buy milk", created: "2026-01-01" }];
    expect(formatListColor(notes)).toBe("\x1b[90m1\x1b[39m. \x1b[32mbuy milk\x1b[39m (2026-01-01)");
  });

  it("colours each line separately", () => {
    const notes: Note[] = [
      { id: 1, text: "a", created: "2026-01-01" },
      { id: 2, text: "b", created: "2026-01-02" },
    ];
    expect(formatListColor(notes)).toBe(
      "\x1b[90m1\x1b[39m. \x1b[32ma\x1b[39m (2026-01-01)\n\x1b[90m2\x1b[39m. \x1b[32mb\x1b[39m (2026-01-02)",
    );
  });

  it("leaves the empty list plain", () => {
    expect(formatListColor([])).toBe("No notes yet.");
  });
});

describe("cli color", () => {
  it("lists in colour when asked", () => {
    const file = tmpFile();
    run(["add", "hello"], file, DAY);
    expect(run(["list"], file, DAY, true)).toEqual({
      code: 0,
      out: "\x1b[90m1\x1b[39m. \x1b[32mhello\x1b[39m (" + DAY + ")",
    });
  });

  it("keeps the empty list plain in colour mode", () => {
    expect(run(["list"], tmpFile(), DAY, true)).toEqual({ code: 0, out: "No notes yet." });
  });

  it("is plain by default", () => {
    const file = tmpFile();
    run(["add", "hello"], file, DAY);
    expect(run(["list"], file, DAY).out).toBe("1. hello (" + DAY + ")");
  });

  it("does not colour add and delete", () => {
    const file = tmpFile();
    expect(run(["add", "x"], file, DAY, true)).toEqual({ code: 0, out: "Added note 1." });
    expect(run(["delete", "1"], file, DAY, true)).toEqual({ code: 0, out: "Deleted note 1." });
  });
});
