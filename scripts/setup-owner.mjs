import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const file = new URL("../.dev.vars", import.meta.url);
let source;
try { source = readFileSync(file, "utf8"); } catch { source = readFileSync(new URL("../.dev.vars.example", import.meta.url), "utf8"); }
const read = key => source.match(new RegExp(`^${key}[ \\t]*=[ \\t]*["']?([^\\s"']+)`, "m"))?.[1];
const configuredEmail = read("TIPOOK_ADMIN_EMAIL");
const argumentEmail = process.argv.find(value => value.startsWith("--email="))?.slice(8)?.trim().toLowerCase();
const email = argumentEmail || configuredEmail;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Nhập email của bạn: node scripts/setup-owner.mjs --email=ban@example.com");
if (argumentEmail && configuredEmail && argumentEmail !== configuredEmail) throw new Error("Email chủ website đã được cấu hình. Hãy cập nhật biến TIPOOK_ADMIN_EMAIL trước khi chạy lại.");
if (read("TIPOOK_ADMIN_PASSWORD")) {
  console.log(`Email chủ website: ${email}. Đã có mật khẩu khởi tạo; không thay đổi.`);
} else {
  const password = randomBytes(18).toString("base64url");
  if (/^TIPOOK_ADMIN_PASSWORD\s*=/m.test(source)) source = source.replace(/^TIPOOK_ADMIN_PASSWORD\s*=.*$/m, `TIPOOK_ADMIN_PASSWORD=${password}`);
  else source = source.trimEnd() + `\nTIPOOK_ADMIN_PASSWORD=${password}\n`;
  if (!configuredEmail || configuredEmail === "EMAIL_DANG_NHAP_ADMIN") source = source.replace(/^TIPOOK_ADMIN_EMAIL\s*=.*$/m, `TIPOOK_ADMIN_EMAIL=${email}`);
  writeFileSync(file, source, { mode: 0o600 });
  console.log(`Email chủ website: ${email}\nMật khẩu khởi tạo: ${password}\nKhởi động lại server, đăng nhập tại /dang-nhap rồi đổi mật khẩu trong Cài đặt.`);
}
