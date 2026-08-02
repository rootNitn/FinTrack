import { Router } from "express";
import { fdFavoritesController } from "./fd-favorites.controller";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { addFdFavoriteSchema } from "./fd-favorites.dto";

export const fdFavoritesRoutes = Router();

fdFavoritesRoutes.use(requireAuth);

fdFavoritesRoutes.get("/", fdFavoritesController.list);
fdFavoritesRoutes.post("/", validate({ body: addFdFavoriteSchema }), fdFavoritesController.add);
fdFavoritesRoutes.delete("/:bankId", fdFavoritesController.remove);
