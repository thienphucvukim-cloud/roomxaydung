import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { walletTransactions, walletWithdrawals, walletSaleCredits } from "../../../db/schema";
import { salesCutoff, SALES_HOLD_MS } from "@/lib/seller-wallet";
import { getPaymentBuyerId } from "../../../lib/payment-identity";

export async function GET() {
  try {
    const userId = await getPaymentBuyerId();
    if (!userId) return Response.json({ balance: 0, depositBalance: 0, salesBalance: 0, salesAvailable: 0, salesLocked: 0, salesHeld: 0, saleCredits: [], transactions: [], withdrawals: [] });
    const db = getDb();
    const cutoff = salesCutoff();
    const [[summary], transactions, withdrawals, [held], saleCredits, [locked]] = await Promise.all([
      db.select({ deposit: sql<number>`coalesce(sum(case when ${walletTransactions.wallet} = 'deposit' then ${walletTransactions.amount} else 0 end), 0)`, sales: sql<number>`coalesce(sum(case when ${walletTransactions.wallet} = 'sales' then ${walletTransactions.amount} else 0 end), 0)` }).from(walletTransactions).where(eq(walletTransactions.userId, userId)),
      db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt)).limit(20),
      db.select().from(walletWithdrawals).where(eq(walletWithdrawals.userId, userId)).orderBy(desc(walletWithdrawals.createdAt)).limit(20),
      db.select({ amount: sql<number>`coalesce(sum(case when ${walletWithdrawals.status} = 'pending' then ${walletWithdrawals.amount} else 0 end), 0)` }).from(walletWithdrawals).where(eq(walletWithdrawals.userId, userId)),
      db.select().from(walletSaleCredits).where(eq(walletSaleCredits.sellerUserId, userId)).orderBy(desc(walletSaleCredits.createdAt)).limit(20),
      db.select({ amount: sql<number>`coalesce(sum(case when ${walletSaleCredits.revokedAt} is null and ${walletSaleCredits.createdAt} > ${cutoff} then ${walletSaleCredits.amount} else 0 end), 0)` }).from(walletSaleCredits).where(eq(walletSaleCredits.sellerUserId, userId)),
    ]);
    const depositBalance = Number(summary?.deposit ?? 0);
    const salesBalance = Number(summary?.sales ?? 0);
    const salesLocked = Number(locked?.amount ?? 0);
    return Response.json({ userId, balance: depositBalance, depositBalance, salesBalance, salesAvailable: Math.max(0, salesBalance - salesLocked), salesLocked, salesHeld: Number(held?.amount ?? 0), saleCredits: saleCredits.map(credit => ({ ...credit, ready: !credit.revokedAt && credit.createdAt <= cutoff, availableAt: new Date(Date.parse(credit.createdAt) + SALES_HOLD_MS).toISOString() })), transactions, withdrawals }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Chưa thể tải Ví NhàĐẹpChất." }, { status: 500 });
  }
}
