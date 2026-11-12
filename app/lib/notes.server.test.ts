import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { getNote, saveNote } from "./notes.server";
import { MAX_NOTE_LENGTH } from "./notes";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const LATER = new Date(2026, 9, 6, 13, 0, 0);

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 1", position: 1 })
    .returning()
    .get().id;
});

describe("saving a Note", () => {
  it("creates the Note with the body trimmed", () => {
    const result = saveNote(db, base.user.id, lessonId, "  # not a heading  ", NOW);

    expect(result.ok).toBe(true);
    expect(getNote(db, base.user.id, lessonId)).toEqual({
      body: "# not a heading",
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last-edited time on when saved again", () => {
    saveNote(db, base.user.id, lessonId, "First thought", NOW);

    const result = saveNote(db, base.user.id, lessonId, "Second thought", LATER);

    expect(result).toMatchObject({
      ok: true,
      note: { body: "Second thought", createdAt: NOW.toISOString(), updatedAt: LATER.toISOString() },
    });
    expect(getNote(db, base.user.id, lessonId)).toEqual({
      body: "Second thought",
      updatedAt: LATER.toISOString(),
    });
  });

  it("keeps one Note per Student per Lesson", () => {
    saveNote(db, base.user.id, lessonId, "First", NOW);
    saveNote(db, base.user.id, lessonId, "Second", LATER);

    expect(db.select().from(schema.notes).all()).toHaveLength(1);
  });

  it(`accepts a Note of exactly ${MAX_NOTE_LENGTH} characters`, () => {
    const body = "a".repeat(MAX_NOTE_LENGTH);

    expect(saveNote(db, base.user.id, lessonId, body, NOW).ok).toBe(true);
    expect(getNote(db, base.user.id, lessonId)?.body).toBe(body);
  });

  it(`refuses a Note over ${MAX_NOTE_LENGTH} characters and stores nothing`, () => {
    const result = saveNote(db, base.user.id, lessonId, "a".repeat(MAX_NOTE_LENGTH + 1), NOW);

    expect(result).toEqual({
      ok: false,
      error: `A note can be at most ${MAX_NOTE_LENGTH} characters.`,
    });
    expect(getNote(db, base.user.id, lessonId)).toBeUndefined();
  });

  it("refuses an empty Note", () => {
    expect(saveNote(db, base.user.id, lessonId, "   ", NOW).ok).toBe(false);
    expect(getNote(db, base.user.id, lessonId)).toBeUndefined();
  });

  it("is not visible to another Student", () => {
    saveNote(db, base.user.id, lessonId, "Mine", NOW);

    expect(getNote(db, base.instructor.id, lessonId)).toBeUndefined();
  });
});
