import { MessagesPanel } from "@/components/MessagesPanel";
import { PageHead } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { listConversations } from "@/lib/repo";

export default async function Messages() {
  const { sid } = await requireManager();
  return (
    <>
      <PageHead title="領養人訊息" sub="領養人透過協會的 LINE 官方帳號聯絡。AI 先回答常見問題，健康疑慮和想退養一律轉到這裡。" />
      <MessagesPanel conversations={await listConversations(sid)} />
    </>
  );
}
