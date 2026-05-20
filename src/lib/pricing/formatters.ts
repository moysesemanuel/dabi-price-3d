export { formatCurrency } from "@/lib/currency/display-currency";

export function formatPercent(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}
