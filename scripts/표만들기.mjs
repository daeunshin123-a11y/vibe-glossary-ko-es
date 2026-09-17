// ─────────────────────────────────────────────────────────────
// 🏗️  표 3개 만들기 (한 번만 실행하면 됩니다)
//
//   실행:  node --env-file=.env.local scripts/표만들기.mjs
//
//   이미 있으면 그냥 넘어갑니다(IF NOT EXISTS). 여러 번 돌려도 안전합니다.
//   💰 0원 — Turso 무료 범위
// ─────────────────────────────────────────────────────────────

import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const 만들기 = [
  // ── ① 용어: 한국어 단어 하나가 한 줄 ──────────────────
  `CREATE TABLE IF NOT EXISTS terms (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     word       TEXT NOT NULL UNIQUE,          -- 🔒 같은 단어 두 번 등록 금지
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  // ── ② 제안: 한 용어에 여러 개가 달립니다 ───────────────
  `CREATE TABLE IF NOT EXISTS suggestions (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     term_id     INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
     translation TEXT NOT NULL,                -- 스페인어 번역
     nickname    TEXT NOT NULL,                -- 별명 (익명)
     note        TEXT,                         -- 왜 이렇게 번역했는지
     created_at  TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE (term_id, translation, nickname)   -- 🔒 같은 사람이 같은 번역 두 번 금지
   )`,

  // ── ③ 좋아요: 누가 어느 제안에 하트를 눌렀는지 ─────────
  `CREATE TABLE IF NOT EXISTS likes (
     suggestion_id INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
     visitor_id    TEXT NOT NULL,              -- 브라우저에 저장된 임의의 번호
     created_at    TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (suggestion_id, visitor_id)   -- 🔒 한 사람이 두 번 못 누름
   )`,

  // ── ④ 댓글: 하나의 제안에 여러 개가 달립니다 ───────────
  `CREATE TABLE IF NOT EXISTS comments (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     suggestion_id INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
     nickname      TEXT NOT NULL,              -- 별명 (익명)
     body          TEXT NOT NULL,              -- 댓글 내용
     created_at    TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  // ── 검색·집계를 빠르게 하는 색인 ──────────────────────
  `CREATE INDEX IF NOT EXISTS idx_suggestions_term ON suggestions(term_id)`,
  `CREATE INDEX IF NOT EXISTS idx_likes_suggestion ON likes(suggestion_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_suggestion ON comments(suggestion_id)`,
];

for (const sql of 만들기) {
  await db.execute(sql);
  const 이름 = sql.match(/(?:TABLE|INDEX) IF NOT EXISTS (\w+)/)?.[1] ?? "?";
  console.log("  ✓", 이름);
}

// ── 나중에 추가된 칸들 ────────────────────────────────
// 이미 쓰고 있는 표에 칸을 더할 때 씁니다.
// 기존 데이터는 그대로 남고, 새 칸만 빈칸으로 생깁니다.
const 칸추가 = [
  // 🙋 번역 요청: 단어만 등록한 사람의 별명
  ["terms", "requested_by", "TEXT"],

  // ✏️ 수정 흔적: 누가 언제 고쳤는지 (위키처럼 누구나 고칠 수 있으므로)
  ["suggestions", "edited_by", "TEXT"],
  ["suggestions", "updated_at", "TEXT"],

  // 🏷 분류: 문화 / 신조어 / 비속어 (비어 있으면 미분류)
  ["terms", "category", "TEXT"],
];

for (const [표, 칸, 형식] of 칸추가) {
  const 지금 = await db.execute(`pragma table_info(${표})`);
  const 있나 = 지금.rows.some((r) => r.name === 칸);
  if (있나) {
    console.log(`  · ${표}.${칸} 이미 있음`);
  } else {
    await db.execute(`ALTER TABLE ${표} ADD COLUMN ${칸} ${형식}`);
    console.log(`  + ${표}.${칸} 추가됨`);
  }
}

const 확인 = await db.execute(
  `select name from sqlite_master
    where type='table' and name not like 'sqlite_%'
    order by name`,
);
console.log("\n현재 표:", 확인.rows.map((r) => r.name).join(", "));
