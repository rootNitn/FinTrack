import { computeHraExemptionDetailed } from "../tax/calculators/calculation-helpers.util";
import { CalculateHraInput } from "./hra.dto";

export const hraService = {
  calculate(input: CalculateHraInput) {
    return computeHraExemptionDetailed(input.basicSalary, input.hraReceived, input.rentPaid, input.state);
  },
};
