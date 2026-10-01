import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { walletTransactions } from "../../../db/schema";
import { getPaymentBuyerId } from "../../../lib/payment-identity";

export async function GET() {
  try {
    const userId = await getPaymentBuyerId();
    if (!userId) return Response.json({ balance: 0, transactions: [] });
    const db = getDb();
    const [[summary], transactions] = await Promise.all([
      db.select({ balance: sql<number>`coalesce(sum(${walletTransactions.amount}), 0)` }).from(walletTransactions).where(eq(walletTransactions.userId, userId)),
      db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt)).limit(20),
    ]);
    return Response.json({ balance: Number(summary?.balance ?? 0), transactions });
  } catch {
    return Response.json({ error: "Chưa thể tải Ví Tipook." }, { status: 500 });
  }
}
