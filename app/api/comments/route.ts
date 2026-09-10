// ─────────────────────────────────────────────────────────────
// 💬 댓글 읽기 / 쓰기
//
//   GET  /api/comments?suggestionId=12     그 번역에 달린 댓글 목록
//   POST /api/comments                     { suggestionId, nickname, body }
//
//   댓글은 '번역(제안)' 아래에 달립니다.
//     용어  >  번역  >  댓글   (3단 구조)
// ─────────────────────────────────────────────────────────────

import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const 최대 = { nickname: 20, body: 300 };

// ── 읽기 ─────────────────────────────────────────────────
export async function GET(요청: Request) {
  try {
    const 주소 = new URL(요청.url);
    const 제안id = Number(주소.searchParams.get("suggestionId"));

    if (!Number.isInteger(제안id) || 제안id <= 0) {
      return new Response("잘못된 요청입니다.", { status: 400 });
    }

    const 결과 = await db.execute({
      sql: `select id, nickname, body, created_at
              from comments
             where suggestion_id = ?
             order by created_at asc
             limit 200`,
      args: [제안id],
    });

    return Response.json({
      댓글들: 결과.rows.map((줄) => ({
        id: Number(줄.id),
        nickname: String(줄.nickname),
        body: String(줄.body),
      })),
    });
  } catch (오류) {
    console.error("[댓글 조회 실패]", 오류);
    return new Response("댓글을 가져오지 못했습니다.", { status: 500 });
  }
}

// ── 쓰기 ─────────────────────────────────────────────────
export async function POST(요청: Request) {
  try {
    const 받은것 = await 요청.json();

    const 제안id = Number(받은것.suggestionId);
    const nickname = String(받은것.nickname ?? "").trim();
    const body = String(받은것.body ?? "").trim();

    if (!Number.isInteger(제안id) || 제안id <= 0) {
      return new Response("잘못된 요청입니다.", { status: 400 });
    }
    if (!nickname) return new Response("별명을 입력해 주세요.", { status: 400 });
    if (!body) return new Response("댓글 내용을 입력해 주세요.", { status: 400 });
    if (nickname.length > 최대.nickname)
      return new Response(`별명은 ${최대.nickname}자 이내로 써주세요.`, { status: 400 });
    if (body.length > 최대.body)
      return new Response(`댓글은 ${최대.body}자 이내로 써주세요.`, { status: 400 });

    // 없는 번역에 댓글이 달리지 않게 확인합니다
    const 있나 = await db.execute({
      sql: `select 1 from suggestions where id = ?`,
      args: [제안id],
    });
    if (있나.rows.length === 0) {
      return new Response("없는 번역입니다.", { status: 404 });
    }

    await db.execute({
      sql: `insert into comments (suggestion_id, nickname, body) values (?, ?, ?)`,
      args: [제안id, nickname, body],
    });

    const 센것 = await db.execute({
      sql: `select count(*) as n from comments where suggestion_id = ?`,
      args: [제안id],
    });

    return Response.json({ ok: true, commentCount: Number(센것.rows[0].n) });
  } catch (오류) {
    console.error("[댓글 등록 실패]", 오류);
    return new Response("댓글을 등록하지 못했습니다.", { status: 500 });
  }
}
