// ─────────────────────────────────────────────────────────────
// ♥ 하트 누르기 / 취소하기
//
//   POST /api/likes
//   { suggestionId, visitorId }
//
//   이미 눌렀으면 → 취소 (한 줄 지움)
//   안 눌렀으면   → 등록 (한 줄 넣음)
//
//   🔒 PRIMARY KEY(suggestion_id, visitor_id) 덕분에
//      같은 사람이 두 번 눌러도 두 줄이 되지 않습니다.
// ─────────────────────────────────────────────────────────────

import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(요청: Request) {
  try {
    const { suggestionId, visitorId } = await 요청.json();

    const 제안id = Number(suggestionId);
    const 방문자 = String(visitorId ?? "").trim();

    if (!Number.isInteger(제안id) || 제안id <= 0) {
      return new Response("잘못된 요청입니다.", { status: 400 });
    }
    if (!방문자) {
      return new Response("방문자 번호가 없습니다.", { status: 400 });
    }

    // 이미 눌렀는지 확인
    const 이미 = await db.execute({
      sql: `select 1 from likes where suggestion_id = ? and visitor_id = ?`,
      args: [제안id, 방문자],
    });

    if (이미.rows.length > 0) {
      // ── 취소 ──
      await db.execute({
        sql: `delete from likes where suggestion_id = ? and visitor_id = ?`,
        args: [제안id, 방문자],
      });
    } else {
      // ── 등록 ── (혹시 동시에 두 번 눌려도 DB가 막아줍니다)
      await db.execute({
        sql: `insert into likes (suggestion_id, visitor_id) values (?, ?)
              on conflict do nothing`,
        args: [제안id, 방문자],
      });
    }

    // 바뀐 개수를 세어서 화면에 돌려줍니다
    const 센것 = await db.execute({
      sql: `select count(*) as n from likes where suggestion_id = ?`,
      args: [제안id],
    });

    return Response.json({
      likeCount: Number(센것.rows[0].n),
      liked: 이미.rows.length === 0, // 방금 눌렀으면 true, 취소했으면 false
    });
  } catch (오류) {
    console.error("[하트 실패]", 오류);
    return new Response("하트를 처리하지 못했습니다.", { status: 500 });
  }
}
