"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type 제안 = {
  id: number;
  translation: string;
  nickname: string;
  note: string | null;
  likeCount: number;
  liked: boolean;
  commentCount: number;
};
type 용어 = { id: number; word: string; 제안들: 제안[] };
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
    return "임시-" + Math.random().toString(36).slice(2); // 저장이 막힌 브라우저 대비
  }
}

export default function Home() {
  const [방문자, 방문자설정] = useState("");
  const [검색어, 검색어설정] = useState("");
  const [용어들, 용어들설정] = useState<용어[]>([]);
  const [불러오는중, 불러오는중설정] = useState(true);
  const [오류, 오류설정] = useState("");

  // 등록 폼
  const [폼열림, 폼열림설정] = useState(false);
  const [원문, 원문설정] = useState("");
  const [번역, 번역설정] = useState("");
  const [별명, 별명설정] = useState("");
  const [메모, 메모설정] = useState("");
  const [보내는중, 보내는중설정] = useState(false);
  const [폼메시지, 폼메시지설정] = useState("");

  // 댓글: 펼친 번역만 불러옵니다 (한꺼번에 다 불러오면 무겁습니다)
  const [펼친제안, 펼친제안설정] = useState<number | null>(null);
  const [댓글맵, 댓글맵설정] = useState<Record<number, 댓글[]>>({});
  const [댓글입력, 댓글입력설정] = useState("");
  const [댓글보내는중, 댓글보내는중설정] = useState(false);
  const [댓글오류, 댓글오류설정] = useState("");

  const 검색타이머 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const 번호 = 방문자번호가져오기();
    방문자설정(번호);
    // 별명은 한 번 쓰면 기억해 둡니다 (매번 다시 쓰기 귀찮으니까요)
    try {
      const 저장된별명 = localStorage.getItem("nickname");
      if (저장된별명) 별명설정(저장된별명);
    } catch {
      /* 저장이 막혀 있어도 그냥 넘어갑니다 */
    }
  }, []);

  const 목록불러오기 = useCallback(
    async (q: string, 번호: string) => {
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
      } catch (e) {
        오류설정(e instanceof Error ? e.message : "목록을 가져오지 못했습니다.");
      } finally {
        불러오는중설정(false);
      }
    },
    [],
  );

  // 방문자 번호가 준비되면 첫 목록을 불러옵니다
  useEffect(() => {
    if (방문자) 목록불러오기("", 방문자);
  }, [방문자, 목록불러오기]);

  // 검색: 타자 칠 때마다 부르면 부담이라, 멈추고 0.3초 뒤에 한 번만 부릅니다
  function 검색어바뀜(값: string) {
    검색어설정(값);
    if (검색타이머.current) clearTimeout(검색타이머.current);
    검색타이머.current = setTimeout(() => 목록불러오기(값, 방문자), 300);
  }

  async function 하트누르기(제안id: number) {
    // 화면부터 먼저 바꿔서 빠릿하게 보이게 합니다 (실패하면 되돌립니다)
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
      용어들설정(되돌리기); // 실패하면 원래대로
    }
  }

  // ── 댓글 펼치기 / 접기 ──────────────────────────────
  async function 댓글토글(제안id: number) {
    댓글오류설정("");
    댓글입력설정("");

    if (펼친제안 === 제안id) {
      펼친제안설정(null); // 이미 펼쳐져 있으면 접습니다
      return;
    }
    펼친제안설정(제안id);

    if (댓글맵[제안id]) return; // 전에 불러온 게 있으면 다시 안 부릅니다

    try {
      const 응답 = await fetch(`/api/comments?suggestionId=${제안id}`);
      if (!응답.ok) throw new Error(await 응답.text());
      const 결과 = await 응답.json();
      댓글맵설정((이전) => ({ ...이전, [제안id]: 결과.댓글들 ?? [] }));
    } catch (e) {
      댓글오류설정(e instanceof Error ? e.message : "댓글을 가져오지 못했습니다.");
    }
  }

  // ── 댓글 쓰기 ───────────────────────────────────────
  async function 댓글쓰기(e: React.FormEvent, 제안id: number) {
    e.preventDefault();
    댓글보내는중설정(true);
    댓글오류설정("");
    try {
      const 응답 = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: 제안id,
          nickname: 별명,
          body: 댓글입력,
        }),
      });
      if (!응답.ok) throw new Error(await 응답.text());
      const { commentCount } = await 응답.json();

      try {
        localStorage.setItem("nickname", 별명.trim());
      } catch {
        /* 저장 실패해도 댓글은 등록됐습니다 */
      }

      // 방금 쓴 댓글을 화면에 바로 붙입니다
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

  async function 등록하기(e: React.FormEvent) {
    e.preventDefault();
    보내는중설정(true);
    폼메시지설정("");
    try {
      const 응답 = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: 원문,
          translation: 번역,
          nickname: 별명,
          note: 메모,
        }),
      });
      if (!응답.ok) throw new Error(await 응답.text());

      try {
        localStorage.setItem("nickname", 별명.trim());
      } catch {
        /* 저장 실패해도 등록은 됐으니 넘어갑니다 */
      }

      // 방금 넣은 단어가 보이도록 그 단어로 검색해 줍니다
      const 넣은단어 = 원문.trim();
      원문설정("");
      번역설정("");
      메모설정("");
      폼열림설정(false);
      검색어설정(넣은단어);
      await 목록불러오기(넣은단어, 방문자);
    } catch (e) {
      폼메시지설정(e instanceof Error ? e.message : "등록하지 못했습니다.");
    } finally {
      보내는중설정(false);
    }
  }

  const 제안개수 = 용어들.reduce((합, 용어) => 합 + 용어.제안들.length, 0);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">📖 스페인어 번역 용어집</h1>
          <p className="mt-2 text-gray-600">
            같은 표현을 다른 번역가들은 어떻게 옮겼는지 찾아보세요.
          </p>
        </header>

        {/* ── 검색 ── */}
        <div className="mt-8">
          <input
            type="search"
            value={검색어}
            onChange={(e) => 검색어바뀜(e.target.value)}
            placeholder="🔍 한국어 · 스페인어 · 메모로 검색"
            className="w-full rounded-xl border border-gray-300 bg-white px-5 py-4 text-lg text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
          />
          <p className="mt-2 text-sm text-gray-500">
            {불러오는중
              ? "찾는 중..."
              : `용어 ${용어들.length}개 · 번역 ${제안개수}개`}
          </p>
        </div>

        {오류 && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            ❌ {오류}
          </p>
        )}

        {/* ── 목록 ── */}
        <div className="mt-4 space-y-4">
          {!불러오는중 && 용어들.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-gray-500">
              {검색어 ? (
                <>
                  <p className="font-medium text-gray-700">
                    &ldquo;{검색어}&rdquo; 에 대한 번역이 아직 없어요.
                  </p>
                  <p className="mt-1 text-sm">첫 번째로 등록해 보시겠어요?</p>
                </>
              ) : (
                <p>아직 등록된 용어가 없습니다. 첫 용어를 남겨보세요.</p>
              )}
            </div>
          )}

          {용어들.map((용어) => (
            <section
              key={용어.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className="flex items-baseline justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-xl font-bold text-gray-900">{용어.word}</h2>
                <span className="text-sm text-gray-500">
                  번역 {용어.제안들.length}개
                </span>
              </div>

              <ul className="divide-y divide-gray-100">
                {용어.제안들.map((제안) => (
                  <li key={제안.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-lg text-gray-900">{제안.translation}</p>
                        {제안.note && (
                          <p className="mt-1 text-sm text-gray-600">
                            💬 {제안.note}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-gray-400">
                          — {제안.nickname}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => 하트누르기(제안.id)}
                        aria-pressed={제안.liked}
                        aria-label={제안.liked ? "하트 취소" : "하트 누르기"}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
                          제안.liked
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : "border-gray-200 text-gray-500 hover:border-rose-200 hover:text-rose-500"
                        }`}
                      >
                        {제안.liked ? "♥" : "♡"} {제안.likeCount}
                      </button>
                    </div>

                    {/* ── 💬 댓글 ── */}
                    <button
                      type="button"
                      onClick={() => 댓글토글(제안.id)}
                      className="mt-3 text-sm text-gray-500 hover:text-gray-900"
                    >
                      💬 댓글 {제안.commentCount}개
                      <span className="ml-1 text-xs">
                        {펼친제안 === 제안.id ? "접기 ▲" : "펼치기 ▼"}
                      </span>
                    </button>

                    {펼친제안 === 제안.id && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-4">
                        {댓글맵[제안.id] === undefined ? (
                          <p className="text-sm text-gray-400">불러오는 중...</p>
                        ) : 댓글맵[제안.id].length === 0 ? (
                          <p className="text-sm text-gray-400">
                            아직 댓글이 없어요. 첫 의견을 남겨보세요.
                          </p>
                        ) : (
                          <ul className="space-y-3">
                            {댓글맵[제안.id].map((댓글) => (
                              <li key={댓글.id} className="text-sm">
                                <p className="text-gray-800">{댓글.body}</p>
                                <p className="mt-0.5 text-xs text-gray-400">
                                  — {댓글.nickname}
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
                            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <input
                              value={별명}
                              onChange={(e) => 별명설정(e.target.value)}
                              placeholder="별명"
                              maxLength={20}
                              className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={댓글보내는중}
                              className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-300"
                            >
                              {댓글보내는중 ? "등록 중..." : "댓글 남기기"}
                            </button>
                          </div>
                          {댓글오류 && (
                            <p className="text-sm text-amber-700">{댓글오류}</p>
                          )}
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* ── 등록 ── */}
        <div className="mt-8">
          {!폼열림 ? (
            <button
              type="button"
              onClick={() => {
                폼열림설정(true);
                if (검색어 && !원문) 원문설정(검색어); // 검색하던 말을 미리 채워줍니다
              }}
              className="w-full rounded-xl bg-gray-900 px-4 py-4 text-lg font-semibold text-white transition hover:bg-gray-700"
            >
              + 내 번역 남기기
            </button>
          ) : (
            <form
              onSubmit={등록하기}
              className="rounded-xl border border-gray-200 bg-white p-6"
            >
              <h2 className="text-lg font-bold text-gray-900">내 번역 남기기</h2>

              <label className="mt-4 block text-sm font-medium text-gray-700">
                한국어 원문
              </label>
              <input
                value={원문}
                onChange={(e) => 원문설정(e.target.value)}
                placeholder="집사"
                maxLength={60}
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none"
              />

              <label className="mt-4 block text-sm font-medium text-gray-700">
                스페인어 번역
              </label>
              <input
                value={번역}
                onChange={(e) => 번역설정(e.target.value)}
                placeholder="sirviente de gatos"
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none"
              />

              <label className="mt-4 block text-sm font-medium text-gray-700">
                왜 이렇게 번역했나요? <span className="text-gray-400">(선택)</span>
              </label>
              <textarea
                value={메모}
                onChange={(e) => 메모설정(e.target.value)}
                placeholder="고양이가 주인이라는 뉘앙스를 살렸어요"
                rows={2}
                maxLength={300}
                className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none"
              />

              <label className="mt-4 block text-sm font-medium text-gray-700">
                별명
              </label>
              <input
                value={별명}
                onChange={(e) => 별명설정(e.target.value)}
                placeholder="바다거북"
                maxLength={20}
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-gray-900 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">
                실명 대신 별명을 써주세요. 로그인은 없습니다.
              </p>

              {폼메시지 && (
                <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
                  className="rounded-lg border border-gray-300 px-5 py-3 text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={보내는중}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white transition hover:bg-gray-700 disabled:bg-gray-300"
                >
                  {보내는중 ? "등록하는 중..." : "등록하기"}
                </button>
              </div>
            </form>
          )}
        </div>

        <footer className="mt-10 text-center text-xs text-gray-400">
          바이브코딩 스터디 5주차 · Next.js + Turso
        </footer>
      </div>
    </main>
  );
}
