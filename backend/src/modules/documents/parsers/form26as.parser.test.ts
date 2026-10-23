import { Form26ASParser } from "./form26as.parser";

describe("Form26ASParser", () => {
  it("extracts labelled values from PDF-like text without treating section headers as amounts", () => {
    const result = new Form26ASParser().parse(`
      Part A Details of Tax Deducted at Source
      TDS on Salary 120000.00
      TDS on Interest 3500.00
      Advance Tax Paid 10000.00
      Self Assessment Tax Paid 5000.00
      Total Tax Paid 138500.00
      Total Refund 0.00
    `);

    expect(result.data).toMatchObject({
      employerTds: 120000,
      bankTds: 3500,
      advanceTax: 10000,
      selfAssessmentTax: 5000,
      totalTaxPaid: 138500,
      refund: 0,
    });
    expect(result.warnings).toEqual([]);
  });

  it("supports Excel-style rows and does not use an unrelated total row", () => {
    const result = new Form26ASParser().parse(`
      Part A\tDetails of Tax Deducted at Source
      TDS on Salary\t₹ 1,20,000
      Total Amount Paid/Credited\t1,20,000
      Total Tax Paid\t1,20,000
    `);

    expect(result.data.employerTds).toBe(120000);
    expect(result.data.totalTaxPaid).toBe(120000);
  });

  it("extracts tax deducted and deposited from the standard Part A total row", () => {
    const result = new Form26ASParser().parse(`
      Part A Details of Tax Deducted at Source
      Total (Rs.) 1809613.38 131589.00 131589.00
    `);

    expect(result.data.employerTds).toBe(131589);
    expect(result.data.totalTaxPaid).toBe(131589);
  });

  it("warns when an AIS statement is uploaded as Form 26AS", () => {
    const result = new Form26ASParser().parse(`
      Annual Information Statement (Part B)
      Part B1-Information relating to tax deducted or collected at source
    `);

    expect(result.warnings).toContain("This appears to be an AIS statement, not Form 26AS. Upload it in the AIS tab to import salary, interest and TDS values.");
  });
});