import { BusinessType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";

export async function ownedBusiness(userId: string, businessId: string, allowedTypes?: BusinessType[]) {
  const business = await prisma.businessProfile.findFirst({ where: { id: businessId, userId } });
  if (!business) throw AppError.notFound("Business not found");
  if (allowedTypes?.length && !allowedTypes.includes(business.type) && business.type !== BusinessType.MIXED) {
    throw AppError.forbidden(`This workflow is not available for ${business.type.toLowerCase()} businesses`);
  }
  return business;
}
