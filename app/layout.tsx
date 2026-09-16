import type { Metadata } from "next";
import { Gowun_Dodum } from "next/font/google";
import "./globals.css";

// 🔤 고운돋움 — 부드럽고 동글동글한 한글 글꼴.
//    구글에서 받아오므로 누가 어떤 기기로 봐도 똑같이 나옵니다.
//    latin 까지 함께 받아서 스페인어 í · ñ · ¡ 도 제대로 나옵니다.
const 고운돋움 = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-고운돋움",
  display: "swap", // 글꼴 받아오는 동안 기본 글꼴로 먼저 보여줍니다
});

export const metadata: Metadata = {
  title: "스페인어 번역 용어집",
  description: "번역가들이 같은 표현을 어떻게 옮겼는지 모으고 찾아보는 곳",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${고운돋움.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
