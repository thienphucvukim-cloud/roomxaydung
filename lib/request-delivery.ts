import { env } from "cloudflare:workers";

type Channel = "zalo" | "messenger" | "telegram";
type DeliveryResult = { status: "sent" | "unavailable" | "failed"; detail?: string };
type RecipientChannels = { zaloUserId?: string | null; messengerPsid?: string | null; telegramChatId?: string | null };

const secrets = env as unknown as Record<string, string | undefined>;

async function sendJson(url: string, headers: Record<string, string>, body: unknown): Promise<DeliveryResult> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { status: "failed", detail: `HTTP ${response.status}` };
    return { status: "sent" };
  } catch {
    return { status: "failed", detail: "network-error" };
  }
}

async function sendTelegramDocument(token: string, chatId: string, file: File, caption: string): Promise<DeliveryResult> {
  try {
    const body = new FormData();
    body.set("chat_id", chatId);
    body.set("document", file, file.name);
    body.set("caption", caption.slice(0, 1024));
    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return { status: "failed", detail: `attachment-HTTP-${response.status}` };
    const result = await response.json() as { ok?: boolean };
    return result.ok ? { status: "sent" } : { status: "failed", detail: "attachment-rejected" };
  } catch { return { status: "failed", detail: "attachment-network-error" }; }
}

export async function deliverExternalMessages(channels: Channel[], recipient: RecipientChannels, message: string, attachment?: { file: File; caption: string }) {
  const results: Partial<Record<Channel, DeliveryResult>> = {};
  if (channels.includes("telegram")) {
    const token = secrets.TELEGRAM_BOT_TOKEN;
    results.telegram = token && recipient.telegramChatId
      ? await sendJson(`https://api.telegram.org/bot${token}/sendMessage`, {}, { chat_id: recipient.telegramChatId, text: message })
      : { status: "unavailable", detail: !token ? "missing-token" : "missing-recipient" };
    if (attachment && results.telegram.status === "sent" && token && recipient.telegramChatId) {
      results.telegram = await sendTelegramDocument(token, recipient.telegramChatId, attachment.file, attachment.caption);
    }
  }
  if (channels.includes("messenger")) {
    const token = secrets.MESSENGER_PAGE_ACCESS_TOKEN;
    const version = secrets.META_GRAPH_VERSION || "v23.0";
    results.messenger = token && recipient.messengerPsid
      ? await sendJson(`https://graph.facebook.com/${version}/me/messages?access_token=${encodeURIComponent(token)}`, {}, { recipient: { id: recipient.messengerPsid }, messaging_type: "RESPONSE", message: { text: message } })
      : { status: "unavailable", detail: !token ? "missing-token" : "missing-recipient" };
  }
  if (channels.includes("zalo")) {
    const token = secrets.ZALO_OA_ACCESS_TOKEN;
    const endpoint = secrets.ZALO_MESSAGE_ENDPOINT || "https://openapi.zalo.me/v3.0/oa/message/cs";
    results.zalo = token && recipient.zaloUserId
      ? await sendJson(endpoint, { access_token: token }, { recipient: { user_id: recipient.zaloUserId }, message: { text: message } })
      : { status: "unavailable", detail: !token ? "missing-token" : "missing-recipient" };
  }
  return results;
}
