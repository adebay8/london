// Bed finance. The logic is retailer-level policy shared with the other
// product searches, so it lives in lib/retail/finance.ts — this module is a
// re-export kept so existing /beds imports stay put.
export { compareFinance, financeFor, financeLabel } from "@/lib/retail/finance";
export type { FinanceOffer } from "@/lib/retail/finance";
