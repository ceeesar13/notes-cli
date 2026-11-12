// notes add [--tag <t>]... <text> | notes list [--tag <t>] | notes delete <id>. Run with: node src/cli.ts <command>
import { addNote, deleteNote, filterByTag, formatList, loadNotes, NotesError, saveNotes, type Note } from "./notes.ts";

export interface Result {
  code: number;
  out: string;
}

const USAGE = "usage: notes add [--tag <t>]... <text> | notes list [--tag <t>] | notes delete <id>";

// Splits `--tag <value>` pairs from the other words. A trailing `--tag` yields an empty tag.
function splitTags(args: string[]): { words: string[]; tags: string[] } {
  const words: string[] = [];
  const tags: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tag") tags.push(args[++i] ?? "");
    else words.push(args[i]);
  }
  return { words, tags };
}

function listCommand(notes: Note[], rest: string[]): Result {
  if (rest.length === 0) return { code: 0, out: formatList(notes) };
  if (rest.length !== 2 || rest[0] !== "--tag") return { code: 2, out: USAGE };
  const found = filterByTag(notes, rest[1]);
  return { code: 0, out: found.length ? formatList(found) : `No notes tagged ${rest[1]}.` };
}

export function run(argv: string[], file: string, today: string): Result {
  const [command, ...rest] = argv;
  try {
    const notes = loadNotes(file);
    if (command === "add") {
      const { words, tags } = splitTags(rest);
      const next = addNote(notes, words.join(" "), today, tags);
      saveNotes(file, next);
      return { code: 0, out: `Added note ${next[next.length - 1].id}.` };
    }
    if (command === "list") return listCommand(notes, rest);
    if (command === "delete") {
      saveNotes(file, deleteNote(notes, Number(rest[0])));
      return { code: 0, out: `Deleted note ${rest[0]}.` };
    }
    return { code: 2, out: USAGE };
  } catch (err) {
    if (err instanceof NotesError || err instanceof SyntaxError) return { code: 1, out: `error: ${err.message}` };
    throw err;
  }
}

if (import.meta.main) {
  const result = run(process.argv.slice(2), process.env.NOTES_FILE ?? "notes.json", new Date().toISOString().slice(0, 10));
  console.log(result.out);
  process.exitCode = result.code;
}
