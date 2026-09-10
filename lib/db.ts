// ─────────────────────────────────────────────────────────────
// 🔌 데이터베이스 연결 (Turso)
//
// 이 파일은 "서버 쪽"에서만 불러 씁니다.
// 화면(page.tsx)에서 직접 부르면 접속 토큰이 브라우저로 새어 나갑니다.
//
// 토큰은 .env.local(로컬) / Vercel 환경변수(배포)에 있고,
// 이 코드는 그 값을 '읽기만' 합니다. 값이 코드에 적혀 있지 않습니다.
//
// ⚠️ 연결은 '실제로 쓸 때' 만듭니다.
//    파일을 읽자마자 연결하면, 조립(build) 단계에서 값이 없거나
//    형식이 틀렸을 때 배포 자체가 실패합니다.
// ─────────────────────────────────────────────────────────────

import {
  createClient,
  type Client,
  type InStatement,
  type ResultSet,
} from "@libsql/client";

let 연결: Client | null = null;

function 주소정리(값: string) {
  // 복사·붙여넣기 하다 딸려온 공백, 따옴표, 줄바꿈을 떼어냅니다
  return 값.trim().replace(/^["']|["']$/g, "");
}

export function getDb(): Client {
  if (연결) return 연결;

  const url = 주소정리(process.env.TURSO_DATABASE_URL ?? "");
  const authToken = 주소정리(process.env.TURSO_AUTH_TOKEN ?? "");

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL 이 비어 있습니다. " +
        "로컬은 .env.local, 배포는 Vercel 환경변수를 확인해 주세요.",
    );
  }
  if (!/^(libsql|https?|wss?):\/\//.test(url)) {
    throw new Error(
      `TURSO_DATABASE_URL 형식이 이상합니다. libsql:// 로 시작해야 합니다. ` +
        `(지금 값은 "${url.slice(0, 12)}..." 로 시작합니다)`,
    );
  }

  연결 = createClient({ url, authToken });
  return 연결;
}

// 기존 코드가 db.execute(...) 로 쓰고 있어서, 그대로 쓸 수 있게 감싸둡니다.
export const db = {
  execute: (명령: InStatement): Promise<ResultSet> => getDb().execute(명령),
};
