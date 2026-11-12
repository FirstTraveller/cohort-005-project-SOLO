import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { toggleBookmark } from "./bookmarks.server";
import { saveNote } from "./notes.server";
import { listBookmarks, listNotes } from "./saved.server";

type TestDb = ReturnType<typeof createTestDb>;

const FIRST = new Date(2026, 9, 6, 12, 0, 0);
const SECOND = new Date(2026, 9, 6, 13, 0, 0);
const THIRD = new Date(2026, 9, 6, 14, 0, 0);

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let otherStudentId: number;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  otherStudentId = db
    .insert(schema.users)
    .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Student })
    .returning()
    .get().id;
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("the Saved lists", () => {
  it("list the Student's Bookmarks newest first, with their Lesson and Course", () => {
    toggleBookmark(db, base.user.id, lessonIds[0], FIRST);
    toggleBookmark(db, base.user.id, lessonIds[1], SECOND);
    toggleBookmark(db, otherStudentId, lessonIds[0], THIRD);

    expect(listBookmarks(db, base.user.id)).toMatchObject([
      { lessonId: lessonIds[1], lessonTitle: "Lesson 2", courseTitle: "Test Course", courseSlug: "test-course" },
      { lessonId: lessonIds[0], lessonTitle: "Lesson 1", courseTitle: "Test Course", courseSlug: "test-course" },
    ]);
  });

  it("list the Student's Notes by last edit, newest first", () => {
    saveNote(db, base.user.id, lessonIds[0], "On lesson 1", FIRST);
    saveNote(db, base.user.id, lessonIds[1], "On lesson 2", SECOND);
    saveNote(db, base.user.id, lessonIds[0], "On lesson 1, edited", THIRD);
    saveNote(db, otherStudentId, lessonIds[1], "Not mine", THIRD);

    expect(listNotes(db, base.user.id)).toMatchObject([
      { lessonId: lessonIds[0], body: "On lesson 1, edited", courseTitle: "Test Course" },
      { lessonId: lessonIds[1], body: "On lesson 2", courseTitle: "Test Course" },
    ]);
  });
});
