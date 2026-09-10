// ─────────────────────────────────────────────────────────────
// 🔍 검색 · 목록 가져오기
//
//   GET /api/terms?q=집사&visitor=abc123
//
//   q       검색어 (비우면 전체)
//   visitor 방문자 번호 — 내가 하트를 눌렀는지 표시하려고 씁니다
// ─────────────────────────────────────────────────────────────

import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // 항상 최신 데이터를 가져옵니다

export async function GET(요청: Request) {
  try {
    const 주소 = new URL(요청.url);
    const 검색어 = (주소.searchParams.get("q") ?? "").trim();
    const 방문자 = (주소.searchParams.get("visitor") ?? "").trim();

    const 찾을말 = `%${검색어}%`; // 비어 있으면 '%%' 라서 전부 걸립니다

    // 표 두 개를 이어 붙이고(JOIN), 하트 개수는 따로 세어(subquery) 옵니다.
    const 결과 = await db.execute({
      sql: `
        select t.id            as term_id,
               t.word          as word,
               s.id            as suggestion_id,
               s.translation   as translation,
               s.nickname      as nickname,
               s.note          as note,
               s.created_at    as created_at,
               (select count(*) from likes l
                 where l.suggestion_id = s.id)                    as like_count,
               (select count(*) from likes l
                 where l.suggestion_id = s.id and l.visitor_id = ?) as liked,
               (select count(*) from comments c
                 where c.suggestion_id = s.id)                    as comment_count
          from terms t
          left join suggestions s on s.term_id = t.id
         where t.id in (
                 select id      from terms       where word like ?
                 union
                 select term_id from suggestions where translation like ?
                                                    or ifnull(note, '') like ?
               )
         order by t.word asc, like_count desc, s.created_at asc
         limit 300
      `,
      args: [방문자, 찾을말, 찾을말, 찾을말],
    });

    // 줄줄이 나온 결과를 '용어 하나에 제안 여러 개' 모양으로 묶습니다.
    type 제안 = {
      id: number;
      translation: string;
      nickname: string;
      note: string | null;
      likeCount: number;
      liked: boolean;
      commentCount: number;
    };
    const 묶음 = new Map<number, { id: number; word: string; 제안들: 제안[] }>();

    for (const 줄 of 결과.rows) {
      const 용어id = Number(줄.term_id);
      if (!묶음.has(용어id)) {
        묶음.set(용어id, { id: 용어id, word: String(줄.word), 제안들: [] });
      }
      if (줄.suggestion_id != null) {
        묶음.get(용어id)!.제안들.push({
          id: Number(줄.suggestion_id),
          translation: String(줄.translation),
          nickname: String(줄.nickname),
          note: 줄.note == null ? null : String(줄.note),
          likeCount: Number(줄.like_count),
          liked: Number(줄.liked) > 0,
          commentCount: Number(줄.comment_count),
        });
      }
    }

    return Response.json({ 용어들: [...묶음.values()] });
  } catch (오류) {
    console.error("[검색 실패]", 오류);
    return new Response("목록을 가져오지 못했습니다.", { status: 500 });
  }
}
