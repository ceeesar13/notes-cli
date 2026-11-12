import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, formatList, NotesError, searchNotes, type Note } from "../src/notes.ts";

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

describe("searchNotes", () => {
  const notes = addNote(addNote([], "buy milk", DAY), "Walk DOG", DAY);

  it("returns only matching notes", () => {
    expect(searchNotes(notes, "milk").map((n) => n.id)).toEqual([1]);
  });

  it("ignores case in both directions", () => {
    expect(searchNotes(notes, "MILK").map((n) => n.id)).toEqual([1]);
    expect(searchNotes(notes, "dog").map((n) => n.id)).toEqual([2]);
  });

  it("matches substrings", () => {
    expect(searchNotes(notes, "mil").length).toBe(1);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchNotes(notes, "cat")).toEqual([]);
  });

  it("refuses empty or whitespace queries", () => {
    expect(() => searchNotes(notes, "")).toThrow(NotesError);
    expect(() => searchNotes(notes, "   ")).toThrow(NotesError);
  });
});

describe("cli search", () => {
  const setup = () => {
    const file = tmpFile();
    run(["add", "buy", "milk"], file, DAY);
    run(["add", "walk", "dog"], file, DAY);
    return file;
  };

  it("prints only matching notes", () => {
    expect(run(["search", "milk"], setup(), DAY)).toEqual({ code: 0, out: "1. buy milk (2026-11-06)" });
  });

  it("is case-insensitive", () => {
    expect(run(["search", "MILK"], setup(), DAY).out).toBe("1. buy milk (2026-11-06)");
  });

  it("supports multi-word queries", () => {
    expect(run(["search", "buy", "milk"], setup(), DAY).out).toBe("1. buy milk (2026-11-06)");
  });

  it("reports no matches with code 0", () => {
    expect(run(["search", "cat"], setup(), DAY)).toEqual({ code: 0, out: "No matching notes." });
  });

  it("errors without text", () => {
    const res = run(["search"], setup(), DAY);
    expect(res.code).toBe(1);
    expect(res.out).toContain("error:");
  });

  it("does not modify the notes file", () => {
    const file = setup();
    const before = readFileSync(file, "utf8");
    run(["search", "milk"], file, DAY);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});
