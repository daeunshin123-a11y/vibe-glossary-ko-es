"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { 별명뽑기 } from "@/lib/별명";
import { 등급이모지, 등급표 } from "@/lib/등급";

type 제안 = {
  id: number;
  translation: string;
  nickname: string;
  note: string | null;
  likeCount: number;
  liked: boolean;
  commentCount: number;
  editedBy: string | null; // ✏️ 마지막으로 고친 사람 (없으면 원본 그대로)
};
type 용어 = {
  id: number;
  word: string;
  requestedBy: string | null;
  제안들: 제안[];
};
type 댓글 = { id: number; nickname: string; body: string };

// 방문자 번호: 하트를 두 번 못 누르게 하려고 브라우저에 하나 저장해 둡니다.
// 이름·이메일 같은 개인정보가 아니라 그냥 임의의 번호입니다.
function 방문자번호가져오기() {
  try {
    let 번호 = localStorage.getItem("visitorId");
    if (!번호) {
      번호 = crypto.randomUUID();
      localStorage.setItem("visitorId", 번호);
    }
    return 번호;
  } catch {
    return "임시-" + Math.random().toString(36).slice(2);
  }
}

export default function Home() {
  const [방문자, 방문자설정] = useState("");
  const [검색어, 검색어설정] = useState("");
  const [용어들, 용어들설정] = useState<용어[]>([]);
  const [기여도, 기여도설정] = useState<Record<string, number>>({});
  const [불러오는중, 불러오는중설정] = useState(true);
  const [오류, 오류설정] = useState("");

  // 등록 폼
  const [폼열림, 폼열림설정] = useState(false);
  const [요청모드, 요청모드설정] = useState(false); // 🙋 번역 없이 요청만
  const [원문, 원문설정] = useState("");
  const [번역, 번역설정] = useState("");
  const [별명, 별명설정] = useState("");
  const [메모, 메모설정] = useState("");
  const [보내는중, 보내는중설정] = useState(false);
  const [폼메시지, 폼메시지설정] = useState("");

  // 댓글
  const [펼친제안, 펼친제안설정] = useState<number | null>(null);
  const [댓글맵, 댓글맵설정] = useState<Record<number, 댓글[]>>({});
  const [댓글입력, 댓글입력설정] = useState("");
  const [댓글보내는중, 댓글보내는중설정] = useState(false);
  const [댓글오류, 댓글오류설정] = useState("");

  // ✏️ 수정 (위키 방식 — 누구나 고칠 수 있습니다)
  const [고치는중, 고치는중설정] = useState<number | null>(null);
  const [새번역, 새번역설정] = useState("");
  const [새메모, 새메모설정] = useState("");
  const [수정보내는중, 수정보내는중설정] = useState(false);
  const [수정오류, 수정오류설정] = useState("");

  // ✍️ 그 자리에서 바로 번역 남기기 (용어 카드 안에서)
  const [인라인, 인라인설정] = useState<number | null>(null); // 열려 있는 용어 id
  const [인라인번역, 인라인번역설정] = useState("");
  const [인라인메모, 인라인메모설정] = useState("");
  const [인라인보내는중, 인라인보내는중설정] = useState(false);
  const [인라인오류, 인라인오류설정] = useState("");

  // 꾸밈 효과
  const [팡, 팡설정] = useState<number | null>(null); // 하트 터지는 중인 제안
  const [복사됨, 복사됨설정] = useState<number | null>(null); // 방금 복사한 제안

  const 검색타이머 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    방문자설정(방문자번호가져오기());
    try {
      const 저장된별명 = localStorage.getItem("nickname");
      별명설정(저장된별명 || 별명뽑기()); // 처음이면 하나 뽑아 둡니다
    } catch {
      별명설정(별명뽑기());
    }
  }, []);

  const 목록불러오기 = useCallback(async (q: string, 번호: string) => {
    if (!번호) return;
    불러오는중설정(true);
    오류설정("");
    try {
      const 응답 = await fetch(
        `/api/terms?q=${encodeURIComponent(q)}&visitor=${encodeURIComponent(번호)}`,
      );
      if (!응답.ok) throw new Error(await 응답.text());
      const 결과 = await 응답.json();
      용어들설정(결과.용어들 ?? []);
      기여도설정(결과.기여도 ?? {});
    } catch (e) {
      오류설정(e instanceof Error ? e.message : "목록을 가져오지 못했습니다.");
    } finally {
      불러오는중설정(false);
    }
  }, []);

  useEffect(() => {
    if (방문자) 목록불러오기("", 방문자);
  }, [방문자, 목록불러오기]);

  function 검색어바뀜(값: string) {
    검색어설정(값);
    if (검색타이머.current) clearTimeout(검색타이머.current);
    검색타이머.current = setTimeout(() => 목록불러오기(값, 방문자), 300);
  }

  // ── 📋 번역문 복사 ─────────────────────────────────
  async function 복사하기(제안id: number, 글: string) {
    try {
      await navigator.clipboard.writeText(글);
    } catch {
      // 클립보드가 막힌 브라우저를 위한 옛날 방식
      const 임시 = document.createElement("textarea");
      임시.value = 글;
      document.body.appendChild(임시);
      임시.select();
      try {
        document.execCommand("copy");
      } catch {
        /* 그래도 안 되면 조용히 포기합니다 */
      }
      document.body.removeChild(임시);
    }
    복사됨설정(제안id);
    setTimeout(() => 복사됨설정((이전) => (이전 === 제안id ? null : 이전)), 1500);
  }

  // ── 💗 하트 ────────────────────────────────────────
  async function 하트누르기(제안id: number, 눌린상태: boolean) {
    if (!눌린상태) {
      팡설정(제안id); // 새로 누를 때만 효과
      setTimeout(() => 팡설정((이전) => (이전 === 제안id ? null : 이전)), 700);
    }

    const 되돌리기 = 용어들;
    용어들설정((이전) =>
      이전.map((용어) => ({
        ...용어,
        제안들: 용어.제안들.map((제안) =>
          제안.id === 제안id
            ? {
                ...제안,
                liked: !제안.liked,
                likeCount: 제안.likeCount + (제안.liked ? -1 : 1),
              }
            : 제안,
        ),
      })),
    );

    try {
      const 응답 = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: 제안id, visitorId: 방문자 }),
      });
      if (!응답.ok) throw new Error(await 응답.text());
      const { likeCount, liked } = await 응답.json();
      용어들설정((이전) =>
        이전.map((용어) => ({
          ...용어,
          제안들: 용어.제안들.map((제안) =>
            제안.id === 제안id ? { ...제안, likeCount, liked } : 제안,
          ),
        })),
      );
    } catch {
      용어들설정(되돌리기);
    }
  }

  // ── 💬 댓글 ────────────────────────────────────────
  async function 댓글토글(제안id: number) {
    댓글오류설정("");
    댓글입력설정("");
    if (펼친제안 === 제안id) {
      펼친제안설정(null);
      return;
    }
    펼친제안설정(제안id);
    if (댓글맵[제안id]) return;
    try {
      const 응답 = await fetch(`/api/comments?suggestionId=${제안id}`);
      if (!응답.ok) throw new Error(await 응답.text());
      const 결과 = await 응답.json();
      댓글맵설정((이전) => ({ ...이전, [제안id]: 결과.댓글들 ?? [] }));
    } catch (e) {
      댓글오류설정(e instanceof Error ? e.message : "댓글을 가져오지 못했습니다.");
    }
  }

  async function 댓글쓰기(e: React.FormEvent, 제안id: number) {
    e.preventDefault();
    댓글보내는중설정(true);
    댓글오류설정("");
    try {
      const 응답 = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: 제안id, nickname: 별명, body: 댓글입력 }),
      });
      if (!응답.ok) throw new Error(await 응답.text());
      const { commentCount } = await 응답.json();
      별명기억();
      댓글맵설정((이전) => ({
        ...이전,
        [제안id]: [
          ...(이전[제안id] ?? []),
          { id: Date.now(), nickname: 별명.trim(), body: 댓글입력.trim() },
        ],
      }));
      용어들설정((이전) =>
        이전.map((용어) => ({
          ...용어,
          제안들: 용어.제안들.map((제안) =>
            제안.id === 제안id ? { ...제안, commentCount } : 제안,
          ),
        })),
      );
      댓글입력설정("");
    } catch (e) {
      댓글오류설정(e instanceof Error ? e.message : "댓글을 등록하지 못했습니다.");
    } finally {
      댓글보내는중설정(false);
    }
  }

  // ── ✏️ 번역 수정 ───────────────────────────────────
  function 고치기시작(제안: 제안) {
    고치는중설정(제안.id);
    새번역설정(제안.translation);
    새메모설정(제안.note ?? "");
    수정오류설정("");
  }

  async function 수정저장(e: React.FormEvent, 제안id: number) {
    e.preventDefault();
    수정보내는중설정(true);
    수정오류설정("");
    try {
      const 응답 = await fetch("/api/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 제안id,
          translation: 새번역,
          note: 새메모,
          nickname: 별명,
        }),
      });
      if (!응답.ok) throw new Error(await 응답.text());
      별명기억();

      용어들설정((이전) =>
        이전.map((용어) => ({
          ...용어,
          제안들: 용어.제안들.map((제안) =>
            제안.id === 제안id
              ? {
                  ...제안,
                  translation: 새번역.trim(),
                  note: 새메모.trim() || null,
                  editedBy: 별명.trim(),
                }
              : 제안,
          ),
        })),
      );
      고치는중설정(null);
    } catch (e) {
      수정오류설정(e instanceof Error ? e.message : "수정하지 못했습니다.");
    } finally {
      수정보내는중설정(false);
    }
  }

  // ── ✍️ 용어 카드 안에서 바로 등록 ──────────────────
  function 인라인열기(용어id: number) {
    인라인설정(용어id);
    인라인번역설정("");
    인라인메모설정("");
    인라인오류설정("");
  }

  async function 인라인등록(e: React.FormEvent, 단어: string) {
    e.preventDefault();
    인라인보내는중설정(true);
    인라인오류설정("");
    try {
      const 응답 = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: 단어,
          translation: 인라인번역,
          nickname: 별명,
          note: 인라인메모,
        }),
      });
      if (!응답.ok) throw new Error(await 응답.text());
      별명기억();
      인라인설정(null);
      인라인번역설정("");
      인라인메모설정("");
      // 보던 자리를 그대로 두고 목록만 새로 받아옵니다
      await 목록불러오기(검색어, 방문자);
    } catch (e) {
      인라인오류설정(e instanceof Error ? e.message : "등록하지 못했습니다.");
    } finally {
      인라인보내는중설정(false);
    }
  }

  function 별명기억() {
    try {
      localStorage.setItem("nickname", 별명.trim());
    } catch {
      /* 저장이 막혀 있어도 등록 자체는 됐습니다 */
    }
  }

  // ── ✍️ 등록 / 🙋 요청 ──────────────────────────────
  async function 등록하기(e: React.FormEvent) {
    e.preventDefault();
    보내는중설정(true);
    폼메시지설정("");
    try {
      const 주소 = 요청모드 ? "/api/requests" : "/api/suggestions";
      const 보낼것 = 요청모드
        ? { word: 원문, nickname: 별명 }
        : { word: 원문, translation: 번역, nickname: 별명, note: 메모 };

      const 응답 = await fetch(주소, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(보낼것),
      });
      if (!응답.ok) throw new Error(await 응답.text());

      별명기억();
      const 넣은단어 = 원문.trim();
      원문설정("");
      번역설정("");
      메모설정("");
      폼열림설정(false);
      요청모드설정(false);
      검색어설정(넣은단어);
      await 목록불러오기(넣은단어, 방문자);
    } catch (e) {
      폼메시지설정(e instanceof Error ? e.message : "등록하지 못했습니다.");
    } finally {
      보내는중설정(false);
    }
  }

  function 폼열기(미리채울단어?: string, 요청으로 = false) {
    폼열림설정(true);
    요청모드설정(요청으로);
    폼메시지설정("");
    if (미리채울단어) 원문설정(미리채울단어);
    else if (검색어 && !원문) 원문설정(검색어);
  }

  const 제안개수 = 용어들.reduce((합, 용어) => 합 + 용어.제안들.length, 0);
  const 기다리는수 = 용어들.filter((용어) => 용어.제안들.length === 0).length;

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="text-center">
          <p className="text-2xl">📖</p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--테라코타)]">
            스페인어 번역 용어집
          </h1>
          <p className="mt-2 text-[var(--연한글자)]">
            ¡Hola! 같은 표현을 다른 번역가들은 어떻게 옮겼을까요?
          </p>
        </header>

        {/* ── 검색 ── */}
        <div className="mt-8">
          <input
            type="search"
            value={검색어}
            onChange={(e) => 검색어바뀜(e.target.value)}
            placeholder="🔍 한국어 · 스페인어 · 메모로 검색"
            className="w-full rounded-2xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-5 py-4 text-lg text-[var(--먹색)] placeholder:text-[var(--연한글자)] focus:border-[var(--테라코타)] focus:outline-none"
          />
          <p className="mt-2 text-sm text-[var(--연한글자)]">
            {불러오는중
              ? "찾는 중..."
              : `용어 ${용어들.length}개 · 번역 ${제안개수}개` +
                (기다리는수 ? ` · 🙋 번역 기다리는 중 ${기다리는수}개` : "")}
          </p>
        </div>

        {오류 && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            ❌ {오류}
          </p>
        )}

        {/* ── 목록 ── */}
        <div className="mt-4 space-y-4">
          {!불러오는중 && 용어들.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-[var(--테두리)] bg-[var(--종이)] px-6 py-12 text-center text-[var(--연한글자)]">
              <p className="text-3xl">🌵</p>
              {검색어 ? (
                <>
                  <p className="mt-3 font-medium text-[var(--먹색)]">
                    &ldquo;{검색어}&rdquo; 에 대한 번역이 아직 없어요.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => 폼열기(검색어, false)}
                      className="rounded-xl bg-[var(--테라코타)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--테라코타진)]"
                    >
                      내가 번역 남기기
                    </button>
                    <button
                      type="button"
                      onClick={() => 폼열기(검색어, true)}
                      className="rounded-xl border-2 border-[var(--테두리)] px-4 py-2 text-sm font-medium text-[var(--먹색)] hover:border-[var(--머스터드)]"
                    >
                      🙋 번역 요청하기
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3">아직 등록된 용어가 없습니다.</p>
              )}
            </div>
          )}

          {용어들.map((용어) => (
            <section
              key={용어.id}
              className="떠오름 overflow-hidden rounded-2xl border-2 border-[var(--테두리)] bg-[var(--종이)]"
            >
              <div className="flex items-baseline justify-between border-b-2 border-[var(--테두리)] px-5 py-4">
                <h2 className="text-xl font-bold text-[var(--먹색)]">{용어.word}</h2>
                <span className="text-sm text-[var(--연한글자)]">
                  {용어.제안들.length > 0
                    ? `번역 ${용어.제안들.length}개`
                    : "🙋 번역 기다리는 중"}
                </span>
              </div>

              {/* 🙋 번역이 아직 없는 단어 */}
              {용어.제안들.length === 0 && 인라인 !== 용어.id && (
                <div className="px-5 py-6 text-center">
                  <p className="text-sm text-[var(--연한글자)]">
                    {용어.requestedBy
                      ? `${등급이모지(기여도, 용어.requestedBy)} ${용어.requestedBy} 님이 번역을 기다리고 있어요`
                      : "아직 번역이 없어요"}
                  </p>
                  <button
                    type="button"
                    onClick={() => 인라인열기(용어.id)}
                    className="mt-3 rounded-xl bg-[var(--머스터드)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    ✍️ 첫 번역 남기기
                  </button>
                </div>
              )}

              <ul className="divide-y-2 divide-[var(--테두리)]">
                {용어.제안들.map((제안) => (
                  <li key={제안.id} className="px-5 py-4">
                    {고치는중 === 제안.id ? (
                      /* ── ✏️ 수정 중 ── */
                      <form onSubmit={(e) => 수정저장(e, 제안.id)} className="떠오름">
                        <p className="text-sm font-semibold text-[var(--테라코타)]">
                          ✏️ 번역 고치기
                        </p>
                        <input
                          value={새번역}
                          onChange={(e) => 새번역설정(e.target.value)}
                          maxLength={200}
                          className="mt-2 w-full rounded-xl border-2 border-[var(--테두리)] px-4 py-3 focus:border-[var(--테라코타)] focus:outline-none"
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-[var(--연한글자)]">
                            💡 번역 이유 (선택)
                          </span>
                          {새메모.trim() && (
                            <button
                              type="button"
                              onClick={() => 새메모설정("")}
                              className="text-xs text-[var(--연한글자)] underline hover:text-[var(--테라코타)]"
                            >
                              설명 지우기
                            </button>
                          )}
                        </div>
                        <textarea
                          value={새메모}
                          onChange={(e) => 새메모설정(e.target.value)}
                          placeholder="왜 이렇게 번역했나요? (비워두면 설명이 사라집니다)"
                          rows={2}
                          maxLength={300}
                          className="mt-1 w-full resize-none rounded-xl border-2 border-[var(--테두리)] px-4 py-3 text-sm focus:border-[var(--테라코타)] focus:outline-none"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={별명}
                            onChange={(e) => 별명설정(e.target.value)}
                            placeholder="별명"
                            maxLength={20}
                            className="w-32 rounded-xl border-2 border-[var(--테두리)] px-3 py-2 text-sm focus:border-[var(--테라코타)] focus:outline-none"
                          />
                          <span className="text-xs text-[var(--연한글자)]">
                            수정하면 이름이 남습니다
                          </span>
                        </div>
                        {수정오류 && (
                          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {수정오류}
                          </p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => 고치는중설정(null)}
                            className="rounded-xl border-2 border-[var(--테두리)] px-4 py-2 text-sm text-[var(--먹색)] hover:bg-[var(--크림)]"
                          >
                            취소
                          </button>
                          <button
                            type="submit"
                            disabled={수정보내는중}
                            className="flex-1 rounded-xl bg-[var(--테라코타)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--테라코타진)] disabled:opacity-40"
                          >
                            {수정보내는중 ? "저장 중..." : "저장하기"}
                          </button>
                        </div>
                      </form>
                    ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-lg text-[var(--먹색)]">
                            {제안.translation}
                          </p>
                          {/* 📋 복사 */}
                          <button
                            type="button"
                            onClick={() => 복사하기(제안.id, 제안.translation)}
                            title="번역문 복사"
                            className="shrink-0 rounded-lg px-2 py-1 text-xs text-[var(--연한글자)] hover:bg-[var(--크림)] hover:text-[var(--테라코타)]"
                          >
                            {복사됨 === 제안.id ? "✓ 복사됨" : "📋"}
                          </button>
                          {/* ✏️ 수정 — 누구나 고칠 수 있습니다 */}
                          <button
                            type="button"
                            onClick={() => 고치기시작(제안)}
                            title="번역 고치기"
                            className="shrink-0 rounded-lg px-2 py-1 text-xs text-[var(--연한글자)] hover:bg-[var(--크림)] hover:text-[var(--테라코타)]"
                          >
                            ✏️
                          </button>
                        </div>
                        {제안.note && (
                          <p className="mt-1 text-sm text-[var(--연한글자)]">
                            💡 {제안.note}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-[var(--연한글자)]">
                          — {등급이모지(기여도, 제안.nickname)} {제안.nickname}
                          {제안.editedBy && (
                            <span className="ml-1">
                              · ✏️ {등급이모지(기여도, 제안.editedBy)}{" "}
                              {제안.editedBy} 님이 수정함
                            </span>
                          )}
                        </p>
                      </div>

                      {/* 💗 하트 */}
                      <button
                        type="button"
                        onClick={() => 하트누르기(제안.id, 제안.liked)}
                        aria-pressed={제안.liked}
                        aria-label={제안.liked ? "하트 취소" : "하트 누르기"}
                        className={`relative shrink-0 rounded-full border-2 px-3 py-1.5 text-sm transition ${
                          제안.liked
                            ? "border-[var(--테라코타)] bg-[var(--테라코타)]/10 text-[var(--테라코타)]"
                            : "border-[var(--테두리)] text-[var(--연한글자)] hover:border-[var(--테라코타)] hover:text-[var(--테라코타)]"
                        } ${팡 === 제안.id ? "하트통통" : ""}`}
                      >
                        {제안.liked ? "♥" : "♡"} {제안.likeCount}
                        {팡 === 제안.id &&
                          ["-24px,-18px", "20px,-22px", "-18px,14px", "22px,12px", "0px,-28px"].map(
                            (좌표, i) => {
                              const [x, y] = 좌표.split(",");
                              return (
                                <span
                                  key={i}
                                  className="작은하트"
                                  style={
                                    {
                                      "--x": x,
                                      "--y": y,
                                      animationDelay: `${i * 30}ms`,
                                    } as React.CSSProperties
                                  }
                                >
                                  ❤️
                                </span>
                              );
                            },
                          )}
                      </button>
                    </div>
                    )}

                    {/* ── 💬 댓글 ── */}
                    <button
                      type="button"
                      onClick={() => 댓글토글(제안.id)}
                      className="mt-3 text-sm text-[var(--연한글자)] hover:text-[var(--테라코타)]"
                    >
                      💬 댓글 {제안.commentCount}개
                      <span className="ml-1 text-xs">
                        {펼친제안 === 제안.id ? "접기 ▲" : "펼치기 ▼"}
                      </span>
                    </button>

                    {펼친제안 === 제안.id && (
                      <div className="떠오름 mt-3 rounded-xl bg-[var(--크림)] p-4">
                        {댓글맵[제안.id] === undefined ? (
                          <p className="text-sm text-[var(--연한글자)]">불러오는 중...</p>
                        ) : 댓글맵[제안.id].length === 0 ? (
                          <p className="text-sm text-[var(--연한글자)]">
                            아직 댓글이 없어요. 첫 의견을 남겨보세요.
                          </p>
                        ) : (
                          <ul className="space-y-3">
                            {댓글맵[제안.id].map((댓글) => (
                              <li key={댓글.id} className="text-sm">
                                <p className="text-[var(--먹색)]">{댓글.body}</p>
                                <p className="mt-0.5 text-xs text-[var(--연한글자)]">
                                  — {등급이모지(기여도, 댓글.nickname)} {댓글.nickname}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}

                        <form
                          onSubmit={(e) => 댓글쓰기(e, 제안.id)}
                          className="mt-4 space-y-2"
                        >
                          <textarea
                            value={댓글입력}
                            onChange={(e) => 댓글입력설정(e.target.value)}
                            placeholder="이 번역에 대한 의견을 남겨주세요"
                            rows={2}
                            maxLength={300}
                            className="w-full resize-none rounded-xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-3 py-2 text-sm focus:border-[var(--테라코타)] focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <input
                              value={별명}
                              onChange={(e) => 별명설정(e.target.value)}
                              placeholder="별명"
                              maxLength={20}
                              className="w-32 rounded-xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-3 py-2 text-sm focus:border-[var(--테라코타)] focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={댓글보내는중}
                              className="flex-1 rounded-xl bg-[var(--테라코타)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--테라코타진)] disabled:opacity-40"
                            >
                              {댓글보내는중 ? "등록 중..." : "댓글 남기기"}
                            </button>
                          </div>
                          {댓글오류 && (
                            <p className="text-sm text-amber-800">{댓글오류}</p>
                          )}
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* ✍️ 이 단어에 바로 번역 남기기 */}
              {인라인 === 용어.id ? (
                <form
                  onSubmit={(e) => 인라인등록(e, 용어.word)}
                  className="떠오름 border-t-2 border-[var(--테두리)] bg-[var(--크림)] px-5 py-4"
                >
                  <p className="text-sm font-semibold text-[var(--테라코타)]">
                    ✍️ &ldquo;{용어.word}&rdquo; 에 내 번역 남기기
                  </p>
                  <input
                    autoFocus
                    value={인라인번역}
                    onChange={(e) => 인라인번역설정(e.target.value)}
                    placeholder="스페인어 번역"
                    maxLength={200}
                    className="mt-2 w-full rounded-xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-4 py-3 focus:border-[var(--테라코타)] focus:outline-none"
                  />
                  <textarea
                    value={인라인메모}
                    onChange={(e) => 인라인메모설정(e.target.value)}
                    placeholder="💡 왜 이렇게 번역했나요? (선택)"
                    rows={2}
                    maxLength={300}
                    className="mt-2 w-full resize-none rounded-xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-4 py-3 text-sm focus:border-[var(--테라코타)] focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <input
                      value={별명}
                      onChange={(e) => 별명설정(e.target.value)}
                      placeholder="별명"
                      maxLength={20}
                      className="w-32 rounded-xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-3 py-2 text-sm focus:border-[var(--테라코타)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => 별명설정(별명뽑기())}
                      title="별명 새로 뽑기"
                      className="rounded-xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-3 text-lg hover:border-[var(--머스터드)]"
                    >
                      🎲
                    </button>
                  </div>
                  {인라인오류 && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {인라인오류}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => 인라인설정(null)}
                      className="rounded-xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-4 py-2 text-sm hover:bg-[var(--크림)]"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={인라인보내는중}
                      className="flex-1 rounded-xl bg-[var(--테라코타)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--테라코타진)] disabled:opacity-40"
                    >
                      {인라인보내는중 ? "등록 중..." : "등록하기"}
                    </button>
                  </div>
                </form>
              ) : (
                용어.제안들.length > 0 && (
                  <button
                    type="button"
                    onClick={() => 인라인열기(용어.id)}
                    className="w-full border-t-2 border-[var(--테두리)] px-5 py-3 text-sm text-[var(--연한글자)] transition hover:bg-[var(--크림)] hover:text-[var(--테라코타)]"
                  >
                    ＋ 이 단어에 내 번역도 남기기
                  </button>
                )
              )}
            </section>
          ))}
        </div>

        {/* ── 등록 / 요청 ── */}
        <div className="mt-8">
          {!폼열림 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => 폼열기(undefined, false)}
                className="flex-1 rounded-2xl bg-[var(--테라코타)] px-4 py-4 text-lg font-semibold text-white transition hover:bg-[var(--테라코타진)]"
              >
                ✍️ 내 번역 남기기
              </button>
              <button
                type="button"
                onClick={() => 폼열기(undefined, true)}
                className="rounded-2xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-5 py-4 text-lg font-semibold text-[var(--먹색)] transition hover:border-[var(--머스터드)]"
                title="번역 없이 단어만 등록해서 물어보기"
              >
                🙋 번역 요청
              </button>
            </div>
          ) : (
            <form
              onSubmit={등록하기}
              className="떠오름 rounded-2xl border-2 border-[var(--테두리)] bg-[var(--종이)] p-6"
            >
              {/* 두 가지 모드를 여기서 바로 바꿀 수 있습니다 */}
              <div className="flex gap-1 rounded-xl bg-[var(--크림)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    요청모드설정(false);
                    폼메시지설정("");
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    !요청모드
                      ? "bg-[var(--종이)] text-[var(--테라코타)] shadow-sm"
                      : "text-[var(--연한글자)] hover:text-[var(--먹색)]"
                  }`}
                >
                  ✍️ 번역 남기기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    요청모드설정(true);
                    폼메시지설정("");
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    요청모드
                      ? "bg-[var(--종이)] text-[var(--테라코타)] shadow-sm"
                      : "text-[var(--연한글자)] hover:text-[var(--먹색)]"
                  }`}
                >
                  🙋 번역 요청하기
                </button>
              </div>

              <p className="mt-3 text-sm text-[var(--연한글자)]">
                {요청모드
                  ? "단어만 남겨두면 다른 번역가가 번역을 달아줍니다."
                  : "내가 옮긴 번역과 그렇게 옮긴 이유를 남겨주세요."}
              </p>

              <label className="mt-4 block text-sm font-medium text-[var(--먹색)]">
                한국어 원문
              </label>
              <input
                value={원문}
                onChange={(e) => 원문설정(e.target.value)}
                placeholder="집사"
                maxLength={60}
                className="mt-1 w-full rounded-xl border-2 border-[var(--테두리)] px-4 py-3 focus:border-[var(--테라코타)] focus:outline-none"
              />

              {!요청모드 && (
                <>
                  <label className="mt-4 block text-sm font-medium text-[var(--먹색)]">
                    스페인어 번역
                  </label>
                  <input
                    value={번역}
                    onChange={(e) => 번역설정(e.target.value)}
                    placeholder="sirviente de gatos"
                    maxLength={200}
                    className="mt-1 w-full rounded-xl border-2 border-[var(--테두리)] px-4 py-3 focus:border-[var(--테라코타)] focus:outline-none"
                  />

                  <label className="mt-4 block text-sm font-medium text-[var(--먹색)]">
                    왜 이렇게 번역했나요?{" "}
                    <span className="text-[var(--연한글자)]">(선택)</span>
                  </label>
                  <textarea
                    value={메모}
                    onChange={(e) => 메모설정(e.target.value)}
                    placeholder="고양이가 주인이라는 뉘앙스를 살렸어요"
                    rows={2}
                    maxLength={300}
                    className="mt-1 w-full resize-none rounded-xl border-2 border-[var(--테두리)] px-4 py-3 focus:border-[var(--테라코타)] focus:outline-none"
                  />
                </>
              )}

              <label className="mt-4 block text-sm font-medium text-[var(--먹색)]">
                별명
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={별명}
                  onChange={(e) => 별명설정(e.target.value)}
                  placeholder="바다거북"
                  maxLength={20}
                  className="flex-1 rounded-xl border-2 border-[var(--테두리)] px-4 py-3 focus:border-[var(--테라코타)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => 별명설정(별명뽑기())}
                  title="별명 새로 뽑기"
                  className="rounded-xl border-2 border-[var(--테두리)] px-4 text-xl transition hover:border-[var(--머스터드)] hover:bg-[var(--크림)]"
                >
                  🎲
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--연한글자)]">
                실명 대신 별명을 써주세요. 🎲 를 누르면 새로 뽑아드려요.
              </p>

              {폼메시지 && (
                <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {폼메시지}
                </p>
              )}

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    폼열림설정(false);
                    폼메시지설정("");
                  }}
                  className="rounded-xl border-2 border-[var(--테두리)] px-5 py-3 text-[var(--먹색)] hover:bg-[var(--크림)]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={보내는중}
                  className="flex-1 rounded-xl bg-[var(--테라코타)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--테라코타진)] disabled:opacity-40"
                >
                  {보내는중
                    ? "보내는 중..."
                    : 요청모드
                      ? "요청 남기기"
                      : "등록하기"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 🌱 등급 안내 */}
        <div className="mt-8 rounded-2xl border-2 border-[var(--테두리)] bg-[var(--종이)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--먹색)]">
            🌱 많이 남길수록 자라나요
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--연한글자)]">
            {[...등급표].reverse().map((단계) => (
              <span key={단계.이름}>
                {단계.이모지} {단계.이름}{" "}
                <span className="text-[var(--테두리)]">·</span> {단계.최소}개~
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--연한글자)]">
            번역 · 댓글 · 남의 번역 다듬기를 합쳐서 셉니다. 같은 별명을 계속 쓰면
            쌓여요.
          </p>
        </div>

        <footer className="mt-6 text-center text-xs text-[var(--연한글자)]">
          바이브코딩 스터디 5주차 · Next.js + Turso
        </footer>
      </div>
    </main>
  );
}
