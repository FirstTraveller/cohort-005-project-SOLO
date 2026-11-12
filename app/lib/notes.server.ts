import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { notes } from "~/db/schema";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

// ─── Notes ───
// A Student's own plain-text writing about a Lesson, private to them. See
// GLOSSARY.md. At most one per Student per Lesson; the unique index on
// (user, lesson) enforces that, not this module.
//
// Only the owning Student's Lesson page and Saved page may read a Note body.
// Every function takes the database first, so tests can hand in an in-memory
// one. Content access is the caller's job: the route checks it first.

export type Db = BetterSQLite3Database<typeof schema>;

type Note = typeof notes.$inferSelect;

export function getNote(db: Db, userId: number, lessonId: number) {
  return db
    .select({ body: notes.body, updatedAt: notes.updatedAt })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
    .get();
}

export type SaveNoteResult =
  | { ok: true; note: Note }
  | { ok: false; error: string };

/**
 * Creates the Student's Note on a Lesson, or replaces its body if one exists.
 * A re-save moves `updatedAt` on and leaves `createdAt` alone. The body is
 * trimmed; an empty or over-long body is refused, never truncated.
 */
export function saveNote(
  db: Db,
  userId: number,
  lessonId: number,
  body: string,
  now: Date
): SaveNoteResult {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Write something before saving." };
  }
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: `A note can be at most ${MAX_NOTE_LENGTH} characters.`,
    };
  }

  const at = now.toISOString();
  const note = db
    .insert(notes)
    .values({ userId, lessonId, body: trimmed, createdAt: at, updatedAt: at })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body: trimmed, updatedAt: at },
    })
    .returning()
    .get();

  return { ok: true, note };
}
