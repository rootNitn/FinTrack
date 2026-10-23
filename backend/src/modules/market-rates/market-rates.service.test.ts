jest.mock("../../config/prisma", () => ({
  prisma: { marketRate: { findMany: jest.fn(), upsert: jest.fn() } },
}));
jest.mock("../../config/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn() },
}));
import { prisma } from "../../config/prisma";
import { marketRatesService } from "./market-rates.service";

describe("market rates availability", () => {
  afterEach(() => jest.restoreAllMocks());

  test("reports unavailable instead of returning an empty successful response", async () => {
    jest.mocked(prisma.marketRate.findMany).mockResolvedValue([]);
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("Provider unavailable"));
    await expect(marketRatesService.getLatestRates()).rejects.toMatchObject({ statusCode: 503 });
    expect(prisma.marketRate.upsert).not.toHaveBeenCalled();
  });

  test("fetches all six quotes with a timeout and caches five display rates", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({
        chart: { result: [{ meta: { regularMarketPrice: 100, chartPreviousClose: 90 } }] },
      }))
    );
    await marketRatesService.refreshMarketRates();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    for (const [, options] of fetchMock.mock.calls) expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(prisma.marketRate.upsert).toHaveBeenCalledTimes(5);
    expect(prisma.marketRate.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { symbol: "NIFTY50" },
      create: expect.objectContaining({ price: 100, changeAmount: 10 }),
    }));
  });
});
