import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, filterByTag, formatList, NotesError, type Note } from "../src/notes.ts";

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
    expect(run(["fly"], tmpFile(), DAY)).toEqual({
      code: 2,
      out: "usage: notes add [--tag <t>]... <text> | notes list [--tag <t>] | notes delete <id>",
    });
  });
});

describe("tags (unit)", () => {
  it("stores normalised tags and none when absent", () => {
    const [n] = addNote([], "x", DAY, [" Work ", "URGENT", "work"]);
    expect(n.tags).toEqual(["work", "urgent"]);
    expect("tags" in addNote([], "x", DAY)[0]).toBe(false);
  });

  it("rejects an empty tag", () => {
    expect(() => addNote([], "x", DAY, ["  "])).toThrow(NotesError);
  });

  it("filters by tag case-insensitively and tolerates legacy notes", () => {
    const legacy: Note = { id: 1, text: "old", created: DAY };
    const notes = addNote([legacy], "new", DAY, ["Work"]);
    expect(filterByTag(notes, "WORK").map((n) => n.id)).toEqual([2]);
    expect(filterByTag([legacy], "x")).toEqual([]);
  });
});

describe("tags (cli)", () => {
  it("adds several tags, flag before or after the text", () => {
    const file = tmpFile();
    expect(run(["add", "--tag", "work", "--tag", "urgent", "x"], file, DAY)).toEqual({ code: 0, out: "Added note 1." });
    expect(run(["add", "y", "--tag", "work"], file, DAY).out).toBe("Added note 2.");
    const stored = JSON.parse(readFileSync(file, "utf8"));
    expect(stored[0].tags).toEqual(["work", "urgent"]);
    expect(stored[1].text).toBe("y");
  });

  it("rejects a missing or empty tag value on add", () => {
    const err = { code: 1, out: "error: a tag needs a name" };
    expect(run(["add", "x", "--tag"], tmpFile(), DAY)).toEqual(err);
    expect(run(["add", "--tag", "", "x"], tmpFile(), DAY)).toEqual(err);
  });

  it("keeps the missing-text error", () => {
    expect(run(["add", "--tag", "a"], tmpFile(), DAY)).toEqual({ code: 1, out: "error: a note needs some text" });
  });

  it("lists only notes with the tag", () => {
    const file = tmpFile();
    run(["add", "--tag", "work", "--tag", "urgent", "a"], file, DAY);
    run(["add", "b"], file, DAY);
    run(["add", "--tag", "home", "c"], file, DAY);
    expect(run(["list", "--tag", "work"], file, DAY)).toEqual({ code: 0, out: "1. a (2026-11-06)" });
    expect(run(["list", "--tag", "URGENT"], file, DAY).out).toBe("1. a (2026-11-06)");
    expect(run(["list", "--tag", "nope"], file, DAY)).toEqual({ code: 0, out: "No notes tagged nope." });
  });

  it("list --tag without a value is a usage error", () => {
    expect(run(["list", "--tag"], tmpFile(), DAY)).toEqual({
      code: 2,
      out: "usage: notes add [--tag <t>]... <text> | notes list [--tag <t>] | notes delete <id>",
    });
  });

  it("keeps legacy files and plain commands working", () => {
    const file = tmpFile();
    writeFileSync(file, JSON.stringify([{ id: 1, text: "old", created: DAY }]));
    expect(run(["list"], file, DAY).out).toBe("1. old (2026-11-06)");
    expect(run(["list", "--tag", "x"], file, DAY)).toEqual({ code: 0, out: "No notes tagged x." });
    expect(run(["add", "new"], file, DAY).out).toBe("Added note 2.");
    expect(run(["delete", "1"], file, DAY)).toEqual({ code: 0, out: "Deleted note 1." });
  });
});
