import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, editNote, formatList, NotesError, type Note } from "../src/notes.ts";

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

  it("edits text and keeps id, created and other notes", () => {
    const notes: Note[] = addNote(addNote([], "a", "2026-01-01"), "b", DAY);
    const next = editNote(notes, 1, "  new  ");
    expect(next[0]).toEqual({ id: 1, text: "new", created: "2026-01-01" });
    expect(next[1]).toEqual(notes[1]);
  });

  it("refuses to edit unknown ids and empty text", () => {
    const notes: Note[] = addNote([], "a", DAY);
    expect(() => editNote(notes, 9, "x")).toThrow(NotesError);
    expect(() => editNote(notes, 9, "x")).toThrow("no note with id 9");
    expect(() => editNote(notes, 1, "")).toThrow("a note needs some text");
    expect(() => editNote(notes, 1, "   ")).toThrow("a note needs some text");
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

  it("edits a note and keeps its created date", () => {
    const file = tmpFile();
    run(["add", "buy", "milk"], file, DAY);
    run(["add", "other"], file, DAY);
    expect(run(["edit", "1", "buy", "oat", "milk"], file, "2026-12-01")).toEqual({ code: 0, out: "Edited note 1." });
    expect(run(["list"], file, DAY).out).toBe("1. buy oat milk (2026-11-06)\n2. other (2026-11-06)");
  });

  it("edit errors leave the file untouched", () => {
    const file = tmpFile();
    run(["add", "keep"], file, DAY);
    const before = readFileSync(file, "utf8");
    expect(run(["edit", "9", "x"], file, DAY)).toEqual({ code: 1, out: "error: no note with id 9" });
    expect(run(["edit", "1"], file, DAY)).toEqual({ code: 1, out: "error: a note needs some text" });
    expect(run(["edit", "1", "  "], file, DAY)).toEqual({ code: 1, out: "error: a note needs some text" });
    expect(readFileSync(file, "utf8")).toBe(before);
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
