// ─────────────────────────────────────────────────────────────
// 🙋 번역 요청하기
//
//   POST /api/requests   { word, nickname }
//
//   번역 없이 '단어만' 등록합니다.
//   "이거 스페인어로 뭐라고 해요?" 하고 남겨두면
//   다른 사람이 나중에 번역을 달아줍니다.
// ─────────────────────────────────────────────────────────────

import { db } from "@/lib/db";

export const runtime = "nodejs";

const 최대 = { word: 60, nickname: 20 };

export async function POST(요청: Request) {
  try {
    const 받은것 = await 요청.json();
    const word = String(받은것.word ?? "").trim();
    const nickname = String(받은것.nickname ?? "").trim();

    if (!word) return new Response("한국어 원문을 입력해 주세요.", { status: 400 });
    if (!nickname) return new Response("별명을 입력해 주세요.", { status: 400 });
    if (word.length > 최대.word)
      return new Response(`원문은 ${최대.word}자 이내로 써주세요.`, { status: 400 });
    if (nickname.length > 최대.nickname)
      return new Response(`별명은 ${최대.nickname}자 이내로 써주세요.`, { status: 400 });

    // 이미 있는 단어인지 확인
    const 있나 = await db.execute({
      sql: `select id, (select count(*) from suggestions s where s.term_id = t.id) as cnt
              from terms t where t.word = ?`,
      args: [word],
    });

    if (있나.rows.length > 0) {
      const 번역수 = Number(있나.rows[0].cnt);
      if (번역수 > 0) {
        return new Response(
          `"${word}" 는 이미 번역이 ${번역수}개 있어요. 검색해 보세요!`,
          { status: 409 },
        );
      }
      return new Response(`"${word}" 는 이미 요청되어 있어요.`, { status: 409 });
    }

    await db.execute({
      sql: `insert into terms (word, requested_by) values (?, ?)`,
      args: [word, nickname],
    });

    return Response.json({ ok: true });
  } catch (오류) {
    console.error("[요청 실패]", 오류);
    return new Response("요청을 남기지 못했습니다.", { status: 500 });
  }
}
