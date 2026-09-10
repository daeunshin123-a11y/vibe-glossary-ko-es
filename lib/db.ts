// ─────────────────────────────────────────────────────────────
// 🔌 데이터베이스 연결 (Turso)
//
// 이 파일은 "서버 쪽"에서만 불러 씁니다.
// 화면(page.tsx)에서 직접 부르면 접속 토큰이 브라우저로 새어 나갑니다.
//
// 토큰은 .env.local 에 있고, 이 코드는 그 값을 '읽기만' 합니다.
// 코드 어디에도 실제 값이 적혀 있지 않습니다.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL 이 비어 있습니다. .env.local 을 확인해 주세요.",
  );
}

export const db = createClient({ url, authToken });
