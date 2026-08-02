import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateFamilyMemberInput, UpdateFamilyMemberInput } from "./family-members.dto";

export const familyMembersService = {
  async list(userId: string) {
    const members = await prisma.familyMember.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: { _count: { select: { expenses: true, investments: true } } },
    });
    return members.map((m) => ({
      ...m,
      usageCount: m._count.expenses + m._count.investments,
      _count: undefined,
    }));
  },

  async create(userId: string, input: CreateFamilyMemberInput) {
    return prisma.familyMember.create({ data: { ...input, userId } });
  },

  async update(userId: string, id: string, input: UpdateFamilyMemberInput) {
    const existing = await prisma.familyMember.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Family member not found");
    return prisma.familyMember.update({ where: { id }, data: input });
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.familyMember.findFirst({ where: { id, userId } });
    if (!existing) throw AppError.notFound("Family member not found");
    // Records linked to this member (expenses/investments) keep their data — the FK is
    // nullable and set to SetNull on delete, so nothing else needs to be cleaned up here.
    await prisma.familyMember.delete({ where: { id } });
  },
};
