// ─────────────────────────────────────────────────────────────
// ✍️  번역 등록하기
//
//   POST /api/suggestions
//   { word, translation, nickname, note }
//
//   ① 용어가 없으면 새로 만들고, 있으면 그걸 씁니다
//   ② 그 용어에 번역을 하나 답니다
//
//   🔒 같은 사람이 같은 용어에 같은 번역을 두 번 넣으면 DB가 거부합니다
// ─────────────────────────────────────────────────────────────

import { db } from "@/lib/db";

export const runtime = "nodejs";

const 최대 = { word: 60, translation: 200, nickname: 20, note: 300 };

export async function POST(요청: Request) {
  try {
    const 받은것 = await 요청.json();

    const word = String(받은것.word ?? "").trim();
    const translation = String(받은것.translation ?? "").trim();
    const nickname = String(받은것.nickname ?? "").trim();
    const note = String(받은것.note ?? "").trim();

    // ── 빈칸 검사 ──────────────────────────────────────
    if (!word) return 나쁜요청("한국어 원문을 입력해 주세요.");
    if (!translation) return 나쁜요청("스페인어 번역을 입력해 주세요.");
    if (!nickname) return 나쁜요청("별명을 입력해 주세요.");

    // ── 길이 검사 ──────────────────────────────────────
    if (word.length > 최대.word) return 나쁜요청(`원문은 ${최대.word}자 이내로 써주세요.`);
    if (translation.length > 최대.translation)
      return 나쁜요청(`번역은 ${최대.translation}자 이내로 써주세요.`);
    if (nickname.length > 최대.nickname)
      return 나쁜요청(`별명은 ${최대.nickname}자 이내로 써주세요.`);
    if (note.length > 최대.note) return 나쁜요청(`메모는 ${최대.note}자 이내로 써주세요.`);

    // ── ① 용어 확보: 없으면 만들고, 있으면 그대로 ──────
    // on conflict do nothing = 이미 있으면 조용히 넘어감 (UNIQUE 덕분)
    await db.execute({
      sql: `insert into terms (word) values (?) on conflict(word) do nothing`,
      args: [word],
    });
    const 용어 = await db.execute({
      sql: `select id from terms where word = ?`,
      args: [word],
    });
    const 용어id = Number(용어.rows[0].id);

    // ── ② 번역 달기 ───────────────────────────────────
    try {
      await db.execute({
        sql: `insert into suggestions (term_id, translation, nickname, note)
              values (?, ?, ?, ?)`,
        args: [용어id, translation, nickname, note || null],
      });
    } catch (오류) {
      // 🔒 UNIQUE(term_id, translation, nickname) 에 걸린 경우
      const 메시지 = 오류 instanceof Error ? 오류.message : "";
      if (/UNIQUE|constraint/i.test(메시지)) {
        return 나쁜요청("이미 같은 번역을 등록하셨어요.", 409);
      }
      throw 오류;
    }

    return Response.json({ ok: true, 용어id });
  } catch (오류) {
    console.error("[등록 실패]", 오류);
    return new Response("등록하지 못했습니다.", { status: 500 });
  }
}

function 나쁜요청(메시지: string, 코드 = 400) {
  return new Response(메시지, { status: 코드 });
}
