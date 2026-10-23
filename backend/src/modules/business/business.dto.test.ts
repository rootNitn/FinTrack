import { createBusinessEntrySchema } from "./business.dto";
import { createJournalEntrySchema } from "./business.accounting.dto";
import { assertBalancedJournal } from "./business.accounting.service";
import { createStockMovementSchema } from "./manufacturing.dto";
import { createSalesInvoiceSchema } from "./sales.dto";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("business workflow validation", () => {
  it("accepts a valid legacy business entry", () => {
    expect(createBusinessEntrySchema.parse({ businessName: "Factory", type: "EXPENSE", amount: 100, date: "2026-09-21" }).amount).toBe(100);
  });

  it("accepts journal line shape before service-level balance enforcement", () => {
    expect(() => createJournalEntrySchema.parse({
      businessId: uuid,
      entryDate: "2026-09-21",
      description: "Unbalanced",
      lines: [
        { accountId: uuid, debit: 100, credit: 0 },
        { accountId: "22222222-2222-4222-8222-222222222222", debit: 0, credit: 90 },
      ],
    })).not.toThrow();
    expect(() => assertBalancedJournal([{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }])).toThrow("not balanced");
    expect(() => assertBalancedJournal([{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }])).not.toThrow();
  });

  it("rejects stock movement quantities that are not positive", () => {
    expect(() => createStockMovementSchema.parse({
      businessId: uuid,
      productId: uuid,
      warehouseId: "33333333-3333-4333-8333-333333333333",
      type: "PURCHASE",
      quantity: 0,
    })).toThrow();
  });

  it("requires invoice lines", () => {
    expect(() => createSalesInvoiceSchema.parse({
      businessId: uuid,
      customerId: uuid,
      invoiceNumber: "INV-1",
      warehouseId: "33333333-3333-4333-8333-333333333333",
      dueDate: "2026-09-30",
      lines: [],
    })).toThrow();
  });
});
