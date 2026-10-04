// node --experimental-vm-modules scripts/test-split-wallets.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import * as orm from "drizzle-orm";
import * as sqliteCore from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as legacyContracts from "../lib/legacy-contracts.ts";

const sqlite = new DatabaseSync(":memory:");
const files = readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort();
for (const file of files.filter(file => file < "0026")) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
sqlite.prepare("INSERT INTO wallet_transactions (user_id,kind,amount,order_code,reference,description,created_at) VALUES ('legacy','topup',123456,1,'legacy','legacy','2026-01-01')").run();
sqlite.exec(readFileSync("drizzle/0026_split_wallets.sql", "utf8"));
sqlite.exec("INSERT INTO wallet_transactions (id,user_id,wallet,kind,amount,order_code,reference,seller_user_id,description,created_at) VALUES (-1,'legacy-buyer','deposit','purchase',-12345,2,'legacy-purchase','legacy-seller','legacy','2026-01-01'); INSERT INTO wallet_sale_credits (purchase_id,seller_user_id,amount,reviewed_by,created_at) VALUES (-1,'legacy-seller',12345,'admin','2026-01-01')");
for (const file of files.filter(file => file > "0026_split_wallets.sql")) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
const legacyCredit = sqlite.prepare("SELECT amount, gross_amount, admin_percent FROM wallet_sale_credits WHERE purchase_id = -1").get();
assert.equal(legacyCredit.amount, 12345);
assert.equal(legacyCredit.gross_amount, 12345);
assert.equal(legacyCredit.admin_percent, 0);
assert.equal(sqlite.prepare("SELECT wallet FROM wallet_transactions WHERE user_id='legacy'").get().wallet, "deposit");

let now = Date.parse("2026-10-02T03:00:00.000Z");
class TestDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
let failOn = "";
const database = {
  prepare(sql) {
    let params = [];
    const statement = {
      bind(...values) { params = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...params) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...params) }; },
      run() {
        if (failOn && sql.includes(failOn)) throw new Error("Simulated database failure");
        return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } };
      },
    };
    return statement;
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
let userId = "seller";
let admin = { userId: "admin" };
let notifications = 0;
const context = createContext({ URL, Response, Request, console, crypto, Date: TestDate });
const compile = file => new SourceTextModule(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context });
const helpers = compile("lib/seller-wallet.ts");
await helpers.link(() => { throw new Error("Unexpected helper import"); });
await helpers.evaluate();
const db = drizzle(async (sql, params, method) => {
  const statement = sqlite.prepare(sql);
  if (method === "run") { statement.run(...params); return { rows: [] }; }
  const rows = statement.all(...params).map(row => Object.values(row));
  return { rows: method === "get" ? rows[0] : rows };
});
function synthetic(namespace) {
  return new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context });
}
const schema = compile("db/schema.ts");
await schema.link(specifier => {
  if (specifier === "../lib/legacy-contracts.ts") return synthetic(legacyContracts);
  assert.equal(specifier, "drizzle-orm/sqlite-core");
  return synthetic(sqliteCore);
});
await schema.evaluate();
const promotionHelpers = compile("lib/catalog-promotions.ts");
await promotionHelpers.link(specifier => {
  assert.equal(specifier, "./legacy-contracts.ts");
  return synthetic(legacyContracts);
});
await promotionHelpers.evaluate();
const namespaces = {
  "cloudflare:workers": { env: { DB: database } },
  "@/lib/admin-auth": { requireAdmin: async () => admin },
  "@/lib/member-access": { memberAccessResponse: async () => userId ? null : Response.json({}, { status: 401 }) },
  "@/lib/payment-identity": { getPaymentBuyerId: async () => userId },
  "@/lib/website-auth": { validOrigin: request => request.headers.get("origin") === new URL(request.url).origin },
  "@/lib/admin-telegram": { notifyAdminTelegram: async () => { notifications++; } },
  "drizzle-orm": orm,
  "@/lib/wallet-products": { resolveWalletProduct: async () => ({ title: "File test", amount: 20000, sellerUserId: "product-seller", targetType: "post", targetId: "999999" }) },
  "@/lib/download-links": { createDownloadToken: async () => "fixture-token" },
  "@/lib/request-target-link": { requestTargetLink: origin => `${origin}/file-ban-ve-nha-dep-chat` },
};
async function route(file) {
  const routeModule = compile(file);
  await routeModule.link(specifier => {
    if (specifier === "@/lib/seller-wallet") return helpers;
    if (specifier.endsWith("/lib/catalog-promotions")) return promotionHelpers;
    if (specifier.endsWith("/db/schema")) return schema;
    let namespace = namespaces[specifier];
    if (specifier.endsWith("/db")) namespace = { getDb: () => db };
    for (const key of Object.keys(namespaces).filter(key => key.startsWith("@/lib/"))) if (specifier.endsWith(key.slice(1))) namespace = namespaces[key];
    if (!namespace) throw new Error(`Unexpected import: ${specifier}`);
    return new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context });
  });
  await routeModule.evaluate();
  return routeModule.namespace;
}
const sellerRoute = await route("app/api/wallet/sales/route.ts");
const adminRoute = await route("app/api/admin/wallet-sales/route.ts");
const walletRoute = await route("app/api/wallet/route.ts");
const adminHistoryRoute = await route("app/api/admin/wallet-topups/route.ts");
const purchaseRoute = await route("app/api/wallet/purchase/route.ts");
const promotionRoute = await route("app/api/catalog-promotions/route.ts");
async function send(api, body, expected, origin = "http://localhost") {
  const response = await api(new Request("http://localhost/api/wallet/test", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
const sell = (body, status = 201, origin) => send(sellerRoute.POST, body, status, origin);
const review = (body, status = 200, origin) => send(adminRoute.PATCH, body, status, origin);
const balance = (id = "seller", wallet = "sales") => sqlite.prepare("SELECT coalesce(sum(amount),0) AS n FROM wallet_transactions WHERE user_id=? AND wallet=?").get(id, wallet).n;
let fixtureCode = 10;
function purchase(amount, seller = "seller", buyer = "buyer") {
  const code = fixtureCode++;
  return Number(sqlite.prepare("INSERT INTO wallet_transactions (user_id,kind,amount,order_code,reference,target_type,target_id,seller_user_id,description,created_at) VALUES (?,'purchase',?,?,?,'post',?,?,?,?)").run(buyer, -amount, code, `purchase:${code}`, String(code), seller, "Purchase", new TestDate().toISOString()).lastInsertRowid);
}
const bank = { bankName: "VCB", accountNumber: "123456789", accountName: "NGUYEN VAN A" };
const transfer = amount => ({ action: "transfer", requestId: crypto.randomUUID(), amount });
const withdraw = amount => ({ action: "withdraw", requestId: crypto.randomUUID(), amount, ...bank });

// Default split, persisted changes, stale previews, rounding and historical rates.
assert.equal((await (await adminHistoryRoute.GET()).json()).adminPercent, 20);
for (const adminPercent of [-1, 100, 20.5, "25", null]) await review({ action: "commission", adminPercent }, 400);
await review({ action: "commission", adminPercent: 25 }, 403, "https://evil.example");
const splitSeller = "split-seller";
const defaultSale = purchase(100000, splitSeller);
const defaultCredit = await review({ action: "credit", purchaseId: defaultSale, adminPercent: 20, amount: 100000 });
assert.equal(defaultCredit.amount, 80000, "Server calculates seller amount independently of client amount");
await review({ action: "commission", adminPercent: 25 });
const changedSale = purchase(100001, splitSeller);
await review({ action: "credit", purchaseId: changedSale, adminPercent: 20 }, 409);
assert.equal((await review({ action: "credit", purchaseId: changedSale, adminPercent: 25 })).amount, 75000);
await review({ action: "commission", adminPercent: 30 });
const lastSale = purchase(100000, splitSeller);
assert.equal((await review({ action: "credit", purchaseId: lastSale, adminPercent: 30 })).amount, 70000);
assert.equal((await review({ action: "credit", purchaseId: defaultSale, adminPercent: 30 })).amount, 80000);
const splitHistory = await (await adminHistoryRoute.GET()).json();
assert.equal(splitHistory.adminPercent, 30);
assert.equal(splitHistory.purchases.find(item => item.id === defaultSale).saleCredit.adminPercent, 20);
assert.equal(splitHistory.purchases.find(item => item.id === changedSale).saleCredit.grossAmount, 100001);
assert.equal(balance(splitSeller), 225000);
await review({ action: "revoke", purchaseId: defaultSale, note: "Thu hồi theo số tiền sau phí" });
assert.equal(balance(splitSeller), 145000, "Revocation recalls only credited seller proceeds");
await review({ action: "commission", adminPercent: 99 });
await review({ action: "credit", purchaseId: purchase(1, splitSeller), adminPercent: 99 }, 400);
// Existing full-value wallet scenarios also exercise the supported 100:0 split.
await review({ action: "commission", adminPercent: 0 });
const p1 = purchase(200000);
const credit1 = { action: "credit", purchaseId: p1 };
userId = null;
await sell(transfer(10000), 401);
userId = "seller";
admin = { error: Response.json({}, { status: 403 }) };
await review({ action: "commission", adminPercent: 30 }, 403);
admin = { error: Response.json({}, { status: 403 }) };
await review(credit1, 403);
admin = { userId: "admin" };
await review(credit1, 403, "https://evil.example");
await sell(transfer(10000), 403, "https://evil.example");
await review({ action: "credit", purchaseId: "1" }, 400);
await review({ action: "credit", purchaseId: 9999 }, 404);
await review({ action: "credit", purchaseId: purchase(0) }, 400);
await review({ action: "credit", purchaseId: purchase(10000, null) }, 400);
await review(credit1);
assert.equal(balance(), 200000);
assert.equal(balance("seller", "deposit"), 0);
let snapshot = await (await walletRoute.GET()).json();
assert.equal(snapshot.salesBalance, 200000);
assert.equal(snapshot.salesAvailable, 0);
assert.equal(snapshot.salesLocked, 200000);
assert.equal(snapshot.balance, 0, "Purchase clients see only the deposit balance");
assert.equal(snapshot.saleCredits[0].ready, false);
assert.equal(snapshot.saleCredits[0].availableAt, "2026-10-03T15:00:00.000Z");
assert.equal((await review(credit1)).replayed, true);
await Promise.all([review(credit1), review(credit1)]);
assert.equal(balance(), 200000, "A sale is credited once even on replay");
for (const invalid of [null, { ...transfer(1), amount: -1 }, { ...transfer(1), amount: "1" }, { ...transfer(1), amount: 1.5 }, { ...transfer(1), requestId: "bad" }, { ...transfer(1), from: "deposit", to: "sales" }, { ...transfer(1), to: "sales" }, { ...transfer(1), action: "deposit-to-sales" }]) await sell(invalid, 400);
await sell(withdraw(49999), 400);
await sell(withdraw(50000), 402);
await sell(transfer(1), 402);
now += 36 * 60 * 60 * 1000 - 1;
await sell(withdraw(50000), 402);
await sell(transfer(1), 402);
now += 1;
snapshot = await (await walletRoute.GET()).json();
assert.equal(snapshot.salesAvailable, 200000);
assert.equal(snapshot.salesLocked, 0);
assert.equal(snapshot.saleCredits[0].ready, true);
const t1 = transfer(30000);
await sell(t1);
assert.equal(balance(), 170000);
assert.equal(balance("seller", "deposit"), 30000);
await sell(t1, 200);
await sell({ ...t1, amount: 40000 }, 409);
assert.equal(balance("seller", "deposit"), 30000);
await sell(withdraw(50000), 201); // Exactly 36 hours and minimum 50k are allowed.
assert.equal(balance(), 120000);
const w1 = withdraw(60000);
await sell(w1);
assert.equal(balance(), 60000);
snapshot = await (await walletRoute.GET()).json();
assert.equal(snapshot.salesHeld, 110000);
assert.equal(snapshot.withdrawals.length, 2);
await sell(w1, 200);
assert.equal(notifications, 2, "Replays do not duplicate the admin notification");
await sell({ ...w1, accountNumber: "99999999" }, 409);
userId = "intruder";
snapshot = await (await walletRoute.GET()).json();
assert.equal(snapshot.withdrawals.length, 0, "Bank details are scoped to the signed-in seller");
await sell(w1, 409);
assert.equal(balance("intruder"), 0);
userId = "seller";
await review({ action: "review", id: w1.requestId, status: "paid", note: "" }, 400);
const reject = { action: "review", id: w1.requestId, status: "rejected", note: "Sai tài khoản" };
await review(reject);
await review(reject);
assert.equal(balance(), 120000, "Rejection refunds only once");
await review({ ...reject, status: "paid", note: "CK123" }, 409);

// A newly credited sale has its own maturity timer; older money remains usable.
const p2 = purchase(100000);
await review({ action: "credit", purchaseId: p2 });
assert.equal(balance(), 220000);
await sell(transfer(120001), 402);
await sell({ ...withdraw(50000), bankName: "", requestId: crypto.randomUUID() }, 400);
const w2 = withdraw(50000);
await sell(w2);
await review({ action: "review", id: w2.requestId, status: "paid", note: "CK456" });
await review({ action: "review", id: w2.requestId, status: "paid", note: "CK456" });
assert.equal(balance(), 170000, "Marking paid does not debit reserved money again");

// Recalling a sale after 36 hours cancels pending payouts and records the reason.
const revoke = { action: "revoke", purchaseId: p1, note: "Khách khiếu nại file lỗi" };
await review({ ...revoke, note: "" }, 400);
await review(revoke);
assert.equal(sqlite.prepare("SELECT status FROM wallet_withdrawals WHERE id=?").get(w2.requestId).status, "paid");
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM wallet_withdrawals WHERE status='pending'").get().n, 0);
assert.equal(balance(), 20000, "Reserved payouts refund before sale revocation");
assert.equal(balance("seller", "deposit"), 30000, "Deposits are not silently recalled");
await review(revoke);
await review(credit1);
assert.equal(balance(), 20000, "Replays cannot restore a recalled sale");
const history = await (await adminHistoryRoute.GET()).json();
assert.equal(history.purchases.find(item => item.id === p1).saleCredit.revocationReason, revoke.note);
assert.ok(history.withdrawals.some(item => item.status === "rejected"));
await sell(transfer(1), 402, undefined); // Remaining 100k is locked and 80k is owed.
const p3 = purchase(50000, "other-seller");
await review({ action: "credit", purchaseId: p3 });
now += 36 * 60 * 60 * 1000;
userId = "other-seller";
const full = withdraw(50000);
await sell(full);
await review({ action: "review", id: full.requestId, status: "paid", note: "CK789" });
await review({ action: "revoke", purchaseId: p3, note: "Khiếu nại sau thanh toán" });
assert.equal(balance("other-seller"), -50000, "Already paid revenue creates sales debt on revocation");
snapshot = await (await walletRoute.GET()).json();
assert.equal(snapshot.salesAvailable, 0);
assert.equal(snapshot.salesBalance, -50000);
await sell(withdraw(50000), 402);

// Concurrent spending cannot overdraw matured money or use deposits as sales.
userId = "seller";
const attempts = await Promise.all([sell(transfer(15000)), sell(withdraw(50000), 402)]);
assert.equal(attempts.length, 2);
assert.equal(balance(), 5000);
assert.equal(balance("seller", "deposit"), 45000);
userId = "legacy";
await sell(withdraw(50000), 402);
await sell(transfer(1), 402);

// Failed batches leave no orphan credits, transfer legs or withdrawal holds.
userId = "atomic";
const atomicPurchase = purchase(100000, "atomic");
failOn = "'sale-credit'";
await review({ action: "credit", purchaseId: atomicPurchase }, 500);
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM wallet_sale_credits WHERE purchase_id=?").get(atomicPurchase).n, 0);
assert.equal(balance("atomic"), 0);
failOn = "";
await review({ action: "credit", purchaseId: atomicPurchase });
now += 36 * 60 * 60 * 1000;
failOn = "'transfer-in'";
const atomicTransfer = transfer(10000);
await sell(atomicTransfer, 500);
assert.equal(balance("atomic"), 100000);
assert.equal(balance("atomic", "deposit"), 0);
failOn = "";
await sell(atomicTransfer);
failOn = "'withdrawal-hold'";
const atomicWithdrawal = withdraw(50000);
await sell(atomicWithdrawal, 500);
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM wallet_withdrawals WHERE id=?").get(atomicWithdrawal.requestId).n, 0);
assert.equal(balance("atomic"), 90000);
failOn = "";
await sell(atomicWithdrawal);
failOn = "'sale-revoke'";
await review({ action: "revoke", purchaseId: atomicPurchase, note: "Lỗi" }, 500);
assert.equal(balance("atomic"), 40000);
assert.equal(sqlite.prepare("SELECT status FROM wallet_withdrawals WHERE id=?").get(atomicWithdrawal.requestId).status, "pending");
failOn = "";
await review({ action: "revoke", purchaseId: atomicPurchase, note: "Lỗi" });
assert.equal(balance("atomic"), -10000);
assert.equal(sqlite.prepare("SELECT status FROM wallet_withdrawals WHERE id=?").get(atomicWithdrawal.requestId).status, "rejected");

// File purchases and promotions cannot spend sales money, even after maturity.
userId = "purchase-check";
const spendingCredit = purchase(100000, userId);
await review({ action: "credit", purchaseId: spendingCredit });
now += 36 * 60 * 60 * 1000;
const fileOrder = { targetType: "post", targetId: "999999", purchaseId: crypto.randomUUID() };
const postId = Number(sqlite.prepare("INSERT INTO posts (user_id,author_name,category,title,content,audience,created_at) VALUES (?,'Author','Bản vẽ cộng đồng','Advert','content','Công khai',?)").run(userId, new TestDate().toISOString()).lastInsertRowid);
const adOrder = { postId, position: 16, months: 1, purchaseId: crypto.randomUUID() };
await send(purchaseRoute.POST, fileOrder, 402);
await send(promotionRoute.POST, adOrder, 402);
assert.equal(balance(userId), 100000);
await sell(transfer(30000));
await send(purchaseRoute.POST, fileOrder, 201);
await send(purchaseRoute.POST, fileOrder, 200);
assert.equal(balance(userId, "deposit"), 10000);
await send(promotionRoute.POST, adOrder, 201);
await send(promotionRoute.POST, adOrder, 200);
assert.equal(balance(userId, "deposit"), 0);
assert.equal(balance(userId), 70000, "Spending only debits the deposit wallet");

// Both requests are individually affordable, but their combined debit is not.
userId = "race-seller";
const racePurchase = purchase(110000, userId);
await review({ action: "credit", purchaseId: racePurchase });
now += 36 * 60 * 60 * 1000;
const raceRequests = [transfer(70000), withdraw(70000)];
const raceResults = await Promise.all(raceRequests.map(body => sellerRoute.POST(new Request("http://localhost/api/wallet/sales", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(body) }))));
assert.deepEqual(raceResults.map(response => response.status).sort(), [201, 402]);
assert.equal(balance(userId), 40000, "Concurrent withdrawal and transfer never overdraw");
const raceWithdrawal = withdraw(50000);
await review({ action: "credit", purchaseId: purchase(50000, userId) });
now += 36 * 60 * 60 * 1000;
await sell(raceWithdrawal);
const reviewRace = await Promise.all(["paid", "rejected"].map(status => adminRoute.PATCH(new Request("http://localhost/api/admin/wallet-sales", { method: "PATCH", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify({ action: "review", id: raceWithdrawal.requestId, status, note: "Race check" }) }))));
assert.deepEqual(reviewRace.map(response => response.status).sort(), [200, 409]);
const terminalStatus = sqlite.prepare("SELECT status FROM wallet_withdrawals WHERE id=?").get(raceWithdrawal.requestId).status;
assert.equal(balance(userId), terminalStatus === "paid" ? 40000 : 90000, "Concurrent reviews reach one terminal state and refund only on rejection");
console.log("PASS: 80:20 / 75:25 / 70:30 splits, persisted fees, stale previews, rounding, historical credits, split wallets, access, maturity, replay, refunds, revocation, concurrent spending and atomic rollback.");
