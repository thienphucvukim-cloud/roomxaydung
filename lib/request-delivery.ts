import { env } from "cloudflare:workers";

type Channel = "zalo" | "messenger" | "telegram";
type DeliveryResult = { status: "sent" | "unavailable" | "failed"; detail?: string };
type RecipientChannels = { zaloUserId?: string | null; messengerPsid?: string | null; telegramChatId?: string | null };

const secrets = env as unknown as Record<string, string | undefined>;

async function sendJson(url: string, headers: Record<string, string>, body: unknown): Promise<DeliveryResult> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    if (!response.ok) return { status: "failed", detail: `HTTP ${response.status}` };
    return { status: "sent" };
  } catch {
    return { status: "failed", detail: "network-error" };
  }
}

export async function deliverExternalMessages(channels: Channel[], recipient: RecipientChannels, message: string) {
  const results: Partial<Record<Channel, DeliveryResult>> = {};
  if (channels.includes("telegram")) {
    const token = secrets.TELEGRAM_BOT_TOKEN;
    results.telegram = token && recipient.telegramChatId
      ? await sendJson(`https://api.telegram.org/bot${token}/sendMessage`, {}, { chat_id: recipient.telegramChatId, text: message })
      : { status: "unavailable", detail: !token ? "missing-token" : "missing-recipient" };
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