import { describe, expect, it } from "vitest";
import { readArTicket, readSession, signArTicket } from "@/lib/auth";

describe("用手機瀏覽器開 AR 的短期票", () => {
  const now = Date.UTC(2026, 10, 25, 8);

  it("只能看發票的那一個紀念", () => {
    const k = signArTicket("m1", now);
    expect(readArTicket(k, "m1", now)).toBe(true);
    expect(readArTicket(k, "m2", now)).toBe(false);
  });

  it("2 小時後失效", () => {
    const k = signArTicket("m1", now);
    expect(readArTicket(k, "m1", now + 119 * 60e3)).toBe(true);
    expect(readArTicket(k, "m1", now + 121 * 60e3)).toBe(false);
  });

  it("改過內容、亂填、沒填都不行；也不能拿來當登入", () => {
    const k = signArTicket("m1", now);
    const [body, sig] = k.split(".");
    const forged = Buffer.from(JSON.stringify({ m: "m2", exp: 9e9 })).toString("base64url");
    expect(readArTicket(`${forged}.${sig}`, "m2", now)).toBe(false);
    expect(readArTicket(`${body}.xx`, "m1", now)).toBe(false);
    expect(readArTicket("亂填", "m1", now)).toBe(false);
    expect(readArTicket(undefined, "m1", now)).toBe(false);
    expect(readSession(k)).toBeNull();
  });
});
