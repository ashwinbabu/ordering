// Order amounts arrive from Postgres `numeric` columns, cast to text by the
// notifications_get_order_context RPC specifically so this code never has to
// round-trip them through a JS float. Formatting stays string-based too.

export function formatMoney(amountText: string | null | undefined, currency: string): string {
  if (amountText == null || amountText === "") return "";
  const negative = amountText.trim().startsWith("-");
  const unsigned = negative ? amountText.trim().slice(1) : amountText.trim();
  const [wholePartRaw, fractionalPartRaw = ""] = unsigned.split(".");
  const wholePart = wholePartRaw.replace(/\D/g, "") || "0";
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = (fractionalPartRaw.replace(/\D/g, "") + "00").slice(0, 2);
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${negative ? "-" : ""}${symbol}${grouped}.${cents}`;
}

/** Pure string check for "is this a nonzero amount" -- avoids parseFloat. */
export function isPositiveAmount(amountText: string | null | undefined): boolean {
  if (!amountText) return false;
  return /[1-9]/.test(amountText);
}
