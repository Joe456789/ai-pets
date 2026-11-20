import { LoginForm } from "@/components/LoginForm";
import { loginAction } from "./actions";

export default async function ShelterLogin({ searchParams }: { searchParams: Promise<{ off?: string }> }) {
  const { off } = await searchParams;
  return (
    <LoginForm
      action={loginAction}
      title="協會管理者登入"
      note="這裡是協會管理者使用的網頁後台。現場人員不需要登入網頁，用工作號綁定協會的 LINE 官方帳號即可。"
      notice={off ? "這個協會的服務目前已暫停，請聯絡平台管理者。" : undefined}
      other={{ href: "/login/admin", label: "平台管理者請由此登入" }}
    />
  );
}
