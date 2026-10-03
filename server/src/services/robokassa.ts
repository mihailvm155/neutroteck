import { createHash } from "node:crypto";
import { config } from "../config.js";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

/** Ссылка на оплату. Подпись: MD5(login:sum:invId:password1). */
export function paymentUrl(opts: { invId: number; amountRub: number; description: string }): string {
  const { login, password1, test } = config.robokassa;
  const sum = opts.amountRub.toFixed(2);
  const q = new URLSearchParams({
    MerchantLogin: login,
    OutSum: sum,
    InvId: String(opts.invId),
    Description: opts.description,
    SignatureValue: md5(`${login}:${sum}:${opts.invId}:${password1}`),
    Culture: "ru",
  });
  if (test) q.set("IsTest", "1");
  return `https://auth.robokassa.ru/Merchant/Index.aspx?${q}`;
}

/** Проверка ResultURL: MD5(OutSum:InvId:password2), регистр не важен. */
export function verifyResult(outSum: string, invId: string, signature: string, password2 = config.robokassa.password2) {
  return md5(`${outSum}:${invId}:${password2}`).toLowerCase() === signature.toLowerCase();
}
