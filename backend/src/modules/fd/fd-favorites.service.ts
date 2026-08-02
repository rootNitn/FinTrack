import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";

export const fdFavoritesService = {
  async list(userId: string) {
    const favorites = await prisma.fdFavoriteBank.findMany({
      where: { userId },
      include: { bank: { include: { rates: true } } },
      orderBy: { createdAt: "desc" },
    });
    return favorites.map((f) => ({
      id: f.id,
      bankId: f.bankId,
      bankName: f.bank.name,
      logoUrl: f.bank.logoUrl,
      bankType: f.bank.bankType,
      rating: f.bank.rating,
      createdAt: f.createdAt.toISOString(),
    }));
  },

  async add(userId: string, bankId: string) {
    const bank = await prisma.fdBank.findUnique({ where: { id: bankId } });
    if (!bank) throw AppError.notFound("Bank not found");
    const existing = await prisma.fdFavoriteBank.findUnique({ where: { userId_bankId: { userId, bankId } } });
    if (existing) return existing;
    return prisma.fdFavoriteBank.create({ data: { userId, bankId } });
  },

  async remove(userId: string, bankId: string) {
    await prisma.fdFavoriteBank.deleteMany({ where: { userId, bankId } });
  },
};
