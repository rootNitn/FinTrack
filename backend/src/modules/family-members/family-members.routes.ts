import { Router } from "express";
import { familyMembersController } from "./family-members.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createFamilyMemberSchema, updateFamilyMemberSchema } from "./family-members.dto";

export const familyMemberRoutes = Router();

familyMemberRoutes.use(requireAuth);
familyMemberRoutes.get("/", familyMembersController.list);
familyMemberRoutes.post("/", validate({ body: createFamilyMemberSchema }), familyMembersController.create);
familyMemberRoutes.patch("/:id", validate({ body: updateFamilyMemberSchema }), familyMembersController.update);
familyMemberRoutes.delete("/:id", familyMembersController.remove);
