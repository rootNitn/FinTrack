import { errorHandler } from "./error-handler";
import { Prisma } from "@prisma/client";

describe("errorHandler", () => {
  it("hides raw Prisma validation details from API responses", () => {
    const req = {} as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();

    const err = new Prisma.PrismaClientValidationError("Invalid prisma.user.findUnique() invocation", {
      clientVersion: "5.22.0",
    });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Something went wrong while processing your request.",
    });
  });
});
