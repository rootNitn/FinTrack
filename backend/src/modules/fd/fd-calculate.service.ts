import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { getFdRateProvider } from "./providers/fd-rate.provider";
import { calculateFd, tenureToDays } from "./fd-calculation.util";
import { CalculateFdInput, LadderPlanInput } from "./fd-calculate.dto";

export const fdCalculateService = {
  async calculate(userId: string | undefined, input: CalculateFdInput) {
    let interestRate = input.interestRate;
    let compounding = input.compounding;

    if (!interestRate && input.bankId) {
      const bank = await getFdRateProvider().getBankById(input.bankId);
      if (!bank) throw AppError.notFound("Bank not found");
      const tenureDays = tenureToDays(input.tenureValue, input.tenureUnit);
      const matchingRate = bank.rates.find((r) => tenureDays >= r.tenureMinDays && tenureDays <= r.tenureMaxDays);
      if (!matchingRate) throw AppError.badRequest("This bank does not offer a rate for the selected tenure");
      interestRate = input.fdType === "SENIOR" ? matchingRate.seniorCitizenRate : matchingRate.interestRate;
      compounding = matchingRate.compounding;
    }

    if (!interestRate) {
      throw AppError.badRequest("Either select a bank or provide an interest rate");
    }

    const result = calculateFd({
      principal: input.principal,
      annualRatePercent: interestRate,
      tenureValue: input.tenureValue,
      tenureUnit: input.tenureUnit,
      depositType: input.depositType,
      compounding,
    });

    await prisma.fdCalculation.create({
      data: {
        userId,
        principal: input.principal,
        fdType: input.fdType,
        depositType: input.depositType,
        tenureDays: result.tenureDays,
        compounding,
        interestRate,
        maturityAmount: result.maturityAmount,
        interestEarned: result.interestEarned,
      },
    });

    return { ...result, interestRateUsed: interestRate, compoundingUsed: compounding };
  },

  /** Suggests a simple FD ladder: splits the total amount evenly across the requested tenure rungs, picking the best available rate per rung. */
  async buildLadderPlan(input: LadderPlanInput) {
    const banks = await getFdRateProvider().getAllBanks(true);
    const perRungAmount = input.totalAmount / input.rungs.length;

    const rungs = input.rungs.map((years) => {
      const tenureDays = years * 365;
      let bestRate = 0;
      let bestBankName = "";
      let bestCompounding: import("@prisma/client").FdCompoundingFrequency = "QUARTERLY";

      for (const bank of banks) {
        const matchingRate = bank.rates.find((r) => tenureDays >= r.tenureMinDays && tenureDays <= r.tenureMaxDays);
        if (!matchingRate) continue;
        const rate = input.fdType === "SENIOR" ? matchingRate.seniorCitizenRate : matchingRate.interestRate;
        if (rate > bestRate) {
          bestRate = rate;
          bestBankName = bank.name;
          bestCompounding = matchingRate.compounding;
        }
      }

      const result =
        bestRate > 0
          ? calculateFd({
              principal: perRungAmount,
              annualRatePercent: bestRate,
              tenureValue: years,
              tenureUnit: "YEARS",
              depositType: "CUMULATIVE",
              compounding: bestCompounding,
            })
          : null;

      return {
        years,
        amount: Number(perRungAmount.toFixed(2)),
        bestBankName: bestBankName || null,
        bestRate: bestRate || null,
        maturityAmount: result?.maturityAmount ?? null,
        interestEarned: result?.interestEarned ?? null,
        maturityDate: result?.maturityDate ?? null,
      };
    });

    return {
      totalAmount: input.totalAmount,
      totalMaturityValue: Number(rungs.reduce((sum, r) => sum + (r.maturityAmount ?? r.amount), 0).toFixed(2)),
      totalInterestEarned: Number(rungs.reduce((sum, r) => sum + (r.interestEarned ?? 0), 0).toFixed(2)),
      rungs,
    };
  },
};
