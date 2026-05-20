export type DisplayCurrency = "BRL" | "USD" | "EUR";

export type CurrencyRates = Record<DisplayCurrency, number>;

export type ExchangeRateSnapshot = {
  base: "BRL";
  date: string | null;
  rates: CurrencyRates;
  sourceLabel: string;
  sourceUrl: string;
};

export const defaultExchangeRateSnapshot: ExchangeRateSnapshot = {
  base: "BRL",
  date: null,
  rates: {
    BRL: 1,
    USD: 0.18,
    EUR: 0.16,
  },
  sourceLabel: "Frankfurter",
  sourceUrl: "https://frankfurter.dev/docs",
};

export const currencyMeta: Record<
  DisplayCurrency,
  { label: string; symbol: string }
> = {
  BRL: { label: "R$", symbol: "R$" },
  USD: { label: "US$", symbol: "US$" },
  EUR: { label: "EUR", symbol: "EUR" },
};

export function convertFromBRL(
  valueInBRL: number,
  currency: DisplayCurrency,
  rates: CurrencyRates,
) {
  return sanitizeNumber(valueInBRL) * getRate(currency, rates);
}

export function convertToBRL(
  valueInDisplayCurrency: number,
  currency: DisplayCurrency,
  rates: CurrencyRates,
) {
  const rate = getRate(currency, rates);

  if (rate <= 0) {
    return 0;
  }

  return sanitizeNumber(valueInDisplayCurrency) / rate;
}

export function formatCurrency(
  value: number,
  currency: DisplayCurrency = "BRL",
) {
  return `${currencyMeta[currency].symbol} ${formatDecimal(value)}`;
}

export function formatDecimal(value: number, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(sanitizeNumber(value));
}

export function parseLocalizedNumber(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalizedValue = value
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getRate(currency: DisplayCurrency, rates: CurrencyRates) {
  if (currency === "BRL") {
    return 1;
  }

  return sanitizeNumber(rates[currency]) || 1;
}

function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}
