import { LoginForm } from "@/components/LoginForm";
import { adminLoginAction } from "./actions";

export default function AdminLogin() {
  return (
    <LoginForm
      action={adminLoginAction}
      title="平台總後台登入"
      note="這裡是浪浪夥伴平台管理者使用的總後台，可以管理所有協會、收費和 AI 用量。"
      other={{ href: "/login/shelter", label: "協會管理者請由此登入" }}
    />
  );
}
