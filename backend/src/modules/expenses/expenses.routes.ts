import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { expensesController } from "./expenses.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createExpenseSchema, updateExpenseSchema, updateExpenseSplitSchema } from "./expenses.dto";

const receiptsDir = path.join(__dirname, "../../../uploads/receipts");
fs.mkdirSync(receiptsDir, { recursive: true });

const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, receiptsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf", ".webp"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

export const expenseRoutes = Router();

expenseRoutes.use(requireAuth);
expenseRoutes.get("/trends/spending", expensesController.spendingTrends);
expenseRoutes.get("/splits/summary", expensesController.splitsSummary);
expenseRoutes.post("/:id/receipt", receiptUpload.single("file"), expensesController.uploadReceipt);
expenseRoutes.post("/scan-receipt", receiptUpload.single("file"), expensesController.scanReceipt);
expenseRoutes.get("/", expensesController.list);
expenseRoutes.post("/", validate({ body: createExpenseSchema }), expensesController.create);
expenseRoutes.get("/:id", expensesController.getById);
expenseRoutes.patch("/:id", validate({ body: updateExpenseSchema }), expensesController.update);
expenseRoutes.patch(
  "/:expenseId/splits/:splitId",
  validate({ body: updateExpenseSplitSchema }),
  expensesController.setSplitSettled
);
expenseRoutes.delete("/:id", expensesController.remove);
