import { BusinessMemberRole, BusinessStockMovementType, BusinessType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateMemberInput } from "./retail.dto";
import { ownedBusiness as ownedBusinessWithType } from "./business-access.util";

const round2 = (value: number) => Number(value.toFixed(2));
const INBOUND = new Set<BusinessStockMovementType>(["PURCHASE", "PRODUCTION_RECEIPT", "ADJUSTMENT_IN", "TRANSFER_IN", "SALES_RETURN"] as BusinessStockMovementType[]);

async function ownedBusiness(userId: string, businessId: string) {
  return ownedBusinessWithType(userId, businessId, [BusinessType.RETAIL]);
}

export const retailService = {
  async catalogue(userId: string, businessId: string, filters: { search?: string; category?: string; lowStockOnly?: boolean }) {
    await ownedBusiness(userId, businessId);
    const products = await prisma.businessProduct.findMany({
      where: { businessId, isActive: true, ...(filters.category ? { retailCategory: filters.category } : {}), ...(filters.search ? { OR: [{ name: { contains: filters.search, mode: "insensitive" } }, { sku: { contains: filters.search, mode: "insensitive" } }, { barcode: { contains: filters.search, mode: "insensitive" } }] } : {}) },
      include: { stockMovements: { select: { type: true, quantity: true } } },
      orderBy: { name: "asc" },
    });
    return products.map((product) => {
      const stock = product.stockMovements.reduce((sum, movement) => sum + (INBOUND.has(movement.type) ? Number(movement.quantity) : -Number(movement.quantity)), 0);
      return { ...product, stock, stockValue: round2(stock * Number(product.standardCost)), lowStock: stock <= Number(product.reorderLevel) };
    }).filter((product) => !filters.lowStockOnly || product.lowStock);
  },

  async summary(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    const [products, invoices] = await Promise.all([
      this.catalogue(userId, businessId, {}),
      prisma.businessSalesInvoice.findMany({ where: { businessId }, include: { lines: { include: { product: true } } } }),
    ]);
    const sold = new Map<string, { quantity: number; revenue: number; cost: number }>();
    for (const invoice of invoices) for (const line of invoice.lines) {
      const current = sold.get(line.productId) ?? { quantity: 0, revenue: 0, cost: 0 };
      current.quantity += Number(line.quantity);
      current.revenue += Number(line.quantity) * Number(line.unitPrice);
      current.cost += Number(line.quantity) * Number(line.costPerUnit);
      sold.set(line.productId, current);
    }
    const performance = products.map((product) => {
      const stats = sold.get(product.id) ?? { quantity: 0, revenue: 0, cost: 0 };
      return { ...product, soldQuantity: stats.quantity, revenue: round2(stats.revenue), cost: round2(stats.cost), margin: round2(stats.revenue - stats.cost), marginPercent: stats.revenue ? round2(((stats.revenue - stats.cost) / stats.revenue) * 100) : 0 };
    }).sort((a, b) => b.soldQuantity - a.soldQuantity);
    return { totalProducts: products.length, lowStockCount: products.filter((product) => product.lowStock).length, inventoryValue: round2(products.reduce((sum, product) => sum + product.stockValue, 0)), revenue: round2(performance.reduce((sum, product) => sum + product.revenue, 0)), margin: round2(performance.reduce((sum, product) => sum + product.margin, 0)), fastMoving: performance.slice(0, 10), slowMoving: [...performance].sort((a, b) => a.soldQuantity - b.soldQuantity).slice(0, 10), reorderSuggestions: products.filter((product) => product.lowStock).map((product) => ({ id: product.id, sku: product.sku, name: product.name, stock: product.stock, reorderLevel: Number(product.reorderLevel), suggestedQuantity: Math.max(0, Number(product.reorderLevel) * 2 - product.stock) })) };
  },

  async members(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessMember.findMany({ where: { businessId, isActive: true }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } });
  },

  async addMember(userId: string, input: CreateMemberInput) {
    await ownedBusiness(userId, input.businessId);
    const member = await prisma.businessMember.upsert({ where: { businessId_userId: { businessId: input.businessId, userId: input.userId } }, update: { role: input.role, isActive: true }, create: input, include: { user: { select: { id: true, name: true, email: true } } } });
    return member;
  },
};
