import { Router } from "express";
import { creditCardsController } from "./credit-cards.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createCreditCardSchema,
  createPaymentSchema,
  createStatementSchema,
  redeemRewardSchema,
  updateCreditCardSchema,
  updateStatementSchema,
} from "./credit-cards.dto";

export const creditCardRoutes = Router();

creditCardRoutes.use(requireAuth);

creditCardRoutes.get("/", creditCardsController.list);
creditCardRoutes.get("/summary", creditCardsController.summary);
creditCardRoutes.post("/", validate({ body: createCreditCardSchema }), creditCardsController.create);
creditCardRoutes.get("/:id", creditCardsController.getById);
creditCardRoutes.patch("/:id", validate({ body: updateCreditCardSchema }), creditCardsController.update);
creditCardRoutes.delete("/:id", creditCardsController.remove);

creditCardRoutes.get("/:cardId/statements", creditCardsController.listStatements);
creditCardRoutes.post(
  "/:cardId/statements",
  validate({ body: createStatementSchema }),
  creditCardsController.createStatement
);
creditCardRoutes.patch(
  "/:cardId/statements/:statementId",
  validate({ body: updateStatementSchema }),
  creditCardsController.updateStatement
);
creditCardRoutes.delete("/:cardId/statements/:statementId", creditCardsController.removeStatement);

creditCardRoutes.get("/:cardId/payments", creditCardsController.listPayments);
creditCardRoutes.post("/:cardId/payments", validate({ body: createPaymentSchema }), creditCardsController.recordPayment);

creditCardRoutes.post("/:cardId/redeem", validate({ body: redeemRewardSchema }), creditCardsController.redeem);
