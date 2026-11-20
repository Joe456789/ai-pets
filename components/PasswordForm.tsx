"use client";
import { useActionState } from "react";
import { changePasswordAction } from "@/app/shelter/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form className="card stack" style={{ gap: 10 }} action={action}>
      <h2 style={{ margin: 0 }}>變更密碼</h2>
      {state?.ok && <p className="ok-box">密碼已更新。</p>}
      {state && !state.ok && <p className="error-box">{state.error}</p>}
      <label className="field">目前的密碼<input name="current" type="password" required autoComplete="current-password" /></label>
      <label className="field">新密碼（至少 10 個字元）<input name="next" type="password" required minLength={10} autoComplete="new-password" /></label>
      <label className="field">再輸入一次新密碼<input name="confirm" type="password" required autoComplete="new-password" /></label>
      <button className="btn" style={{ justifySelf: "start" }} disabled={pending}>更新密碼</button>
    </form>
  );
}
