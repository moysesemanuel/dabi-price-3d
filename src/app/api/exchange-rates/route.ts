import { defaultExchangeRateSnapshot } from "@/lib/currency/display-currency";
import { outboundFetch } from "@/lib/server/http";

type FrankfurterResponse = {
  base?: string;
  date?: string;
  rates?: {
    USD?: number;
    EUR?: number;
  };
};

export async function GET() {
  try {
    const response = await outboundFetch(
      "https://api.frankfurter.dev/v2/rates?base=BRL&quotes=USD,EUR",
      {
        integration: "exchange_rates",
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Frankfurter returned ${response.status}`);
    }

    const payload = (await response.json()) as FrankfurterResponse;

    return Response.json({
      base: "BRL",
      date: payload.date ?? null,
      rates: {
        BRL: 1,
        USD:
          typeof payload.rates?.USD === "number"
            ? payload.rates.USD
            : defaultExchangeRateSnapshot.rates.USD,
        EUR:
          typeof payload.rates?.EUR === "number"
            ? payload.rates.EUR
            : defaultExchangeRateSnapshot.rates.EUR,
      },
      sourceLabel: "Frankfurter",
      sourceUrl: "https://frankfurter.dev/docs",
    });
  } catch {
    return Response.json(defaultExchangeRateSnapshot);
  }
}
