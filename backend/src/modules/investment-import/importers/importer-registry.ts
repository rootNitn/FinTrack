import ExcelJS from "exceljs";
import { InvestmentImporter } from "../types";
import { growwImporter } from "./groww-importer";
import { growwHoldingSummaryImporter } from "./groww-holding-summary-importer";
import { growwStocksImporter } from "./groww-stocks-importer";
import { growwStocksHoldingSummaryImporter } from "./groww-stocks-holding-summary-importer";
import { zerodhaImporter } from "./zerodha-importer";
import { upstoxImporter } from "./upstox-importer";
import { genericCsvImporter } from "./generic-csv-importer";

/**
 * Central registry of supported broker/provider statement importers.
 *
 * To support a new provider in the future (Angel One, ICICI Direct, etc.), implement
 * the `InvestmentImporter` interface in a new file under this folder and add it to
 * this array — nothing else in the parse/validate/commit pipeline needs to change.
 * Order matters: more specific importers should be listed before more generic ones
 * since `detect()` returns the first match. `genericCsvImporter` never auto-matches
 * (see its `canHandle`) — it's only resolved by key during the manual column-mapping
 * import flow.
 */
const importers: InvestmentImporter[] = [
  growwImporter,
  growwHoldingSummaryImporter,
  growwStocksImporter,
  growwStocksHoldingSummaryImporter,
  zerodhaImporter,
  upstoxImporter,
  genericCsvImporter,
];

export const importerRegistry = {
  /** Returns the first importer that recognizes the workbook's shape, or null if none match. */
  detect(workbook: ExcelJS.Workbook): InvestmentImporter | null {
    return importers.find((importer) => importer.canHandle(workbook)) ?? null;
  },
  /** Looks up a previously-detected importer by its stable provider key (used again at commit time). */
  getByKey(providerKey: string): InvestmentImporter | null {
    return importers.find((importer) => importer.providerKey === providerKey) ?? null;
  },
  all(): InvestmentImporter[] {
    return importers;
  },
};
