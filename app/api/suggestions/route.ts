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
    const category = String(받은것.category ?? "").trim(); // 🏷 문화/신조어/비속어

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
      sql: `insert into terms (word, category) values (?, ?)
            on conflict(word) do nothing`,
      args: [word, 분류정리(category)],
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

// 🏷 정해진 분류만 받습니다. 그 밖의 값은 '미분류'(null)로 둡니다.
export const 분류들 = ["문화", "신조어", "비속어"] as const;

function 분류정리(값: string) {
  return (분류들 as readonly string[]).includes(값) ? 값 : null;
}

// ─────────────────────────────────────────────────────────────
// ✏️ 번역 수정하기 (위키 방식 — 누구나 고칠 수 있습니다)
//
//   PATCH /api/suggestions
//   { id, translation, note, nickname }
//
//   누구나 고칠 수 있는 대신, '누가 고쳤는지'를 남겨서
//   아무도 몰래 바꾸지 못하게 합니다.
//   원문(단어)과 처음 올린 사람의 별명은 바꾸지 않습니다.
// ─────────────────────────────────────────────────────────────
export async function PATCH(요청: Request) {
  try {
    const 받은것 = await 요청.json();

    const id = Number(받은것.id);
    const translation = String(받은것.translation ?? "").trim();
    const note = String(받은것.note ?? "").trim();
    const category = String(받은것.category ?? "").trim(); // 🏷 문화/신조어/비속어
    const nickname = String(받은것.nickname ?? "").trim();

    if (!Number.isInteger(id) || id <= 0) return 나쁜요청("잘못된 요청입니다.");
    if (!translation) return 나쁜요청("스페인어 번역을 입력해 주세요.");
    if (!nickname) return 나쁜요청("수정하려면 별명을 입력해 주세요.");
    if (translation.length > 최대.translation)
      return 나쁜요청(`번역은 ${최대.translation}자 이내로 써주세요.`);
    if (note.length > 최대.note)
      return 나쁜요청(`메모는 ${최대.note}자 이내로 써주세요.`);
    if (nickname.length > 최대.nickname)
      return 나쁜요청(`별명은 ${최대.nickname}자 이내로 써주세요.`);

    const 있나 = await db.execute({
      sql: `select id, term_id from suggestions where id = ?`,
      args: [id],
    });
    if (있나.rows.length === 0) return 나쁜요청("없는 번역입니다.", 404);

    const 용어id = Number(있나.rows[0].term_id);

    // 🏷 분류도 함께 고칠 수 있습니다 (잘못 넣은 분류를 바로잡을 수 있게)
    const 새분류 = 분류정리(category);
    if (새분류) {
      await db.execute({
        sql: `update terms set category = ? where id = ?`,
        args: [새분류, 용어id],
      });
    }

    // 📝 한국어 원문도 고칠 수 있습니다 (오타 바로잡기용)
    //    ⚠️ 이 단어에 달린 모든 번역·하트·댓글이 함께 따라갑니다.
    const word = String(받은것.word ?? "").trim();
    if (word) {
      if (word.length > 최대.word)
        return 나쁜요청(`원문은 ${최대.word}자 이내로 써주세요.`);

      // 이미 있는 단어로는 못 바꿉니다 (두 단어가 합쳐지면 되돌리기 어려움)
      const 겹침 = await db.execute({
        sql: `select id from terms where word = ? and id <> ?`,
        args: [word, 용어id],
      });
      if (겹침.rows.length > 0) {
        return 나쁜요청(
          `"${word}" 는 이미 등록된 단어예요. 다른 이름으로 바꿔주세요.`,
          409,
        );
      }

      await db.execute({
        sql: `update terms set word = ? where id = ?`,
        args: [word, 용어id],
      });
    }

    try {
      await db.execute({
        sql: `update suggestions
                 set translation = ?, note = ?, edited_by = ?,
                     updated_at = datetime('now')
               where id = ?`,
        args: [translation, note || null, nickname, id],
      });
    } catch (오류) {
      // 🔒 UNIQUE(term_id, translation, nickname) 에 걸린 경우
      const 메시지 = 오류 instanceof Error ? 오류.message : "";
      if (/UNIQUE|constraint/i.test(메시지)) {
        return 나쁜요청("같은 번역이 이미 등록되어 있어요.", 409);
      }
      throw 오류;
    }

    return Response.json({ ok: true });
  } catch (오류) {
    console.error("[수정 실패]", 오류);
    return new Response("수정하지 못했습니다.", { status: 500 });
  }
}
