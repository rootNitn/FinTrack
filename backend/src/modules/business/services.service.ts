import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { BusinessType } from "@prisma/client";
import { ownedBusiness as ownedBusinessWithType } from "./business-access.util";
import { CreateServiceClientInput, CreateServiceContractInput, CreateServiceExpenseInput, CreateServiceProjectInput, CreateTimesheetInput } from "./services.dto";
import { CreateMilestoneInput, CreateServiceInvoiceInput } from "./services-completion.dto";

const round2 = (value: number) => Number(value.toFixed(2));

async function ownedBusiness(userId: string, businessId: string) {
  return ownedBusinessWithType(userId, businessId, [BusinessType.SERVICES]);
}

async function ownedProject(userId: string, projectId: string) {
  const project = await prisma.businessServiceProject.findFirst({ where: { id: projectId, business: { userId } } });
  if (!project) throw AppError.notFound("Service project not found");
  return project;
}

export const servicesService = {
  async clients(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessServiceClient.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } });
  },

  async createClient(userId: string, input: CreateServiceClientInput) {
    await ownedBusiness(userId, input.businessId);
    return prisma.businessServiceClient.create({ data: input });
  },

  async projects(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessServiceProject.findMany({ where: { businessId }, include: { client: true, contracts: true }, orderBy: { createdAt: "desc" } });
  },

  async createProject(userId: string, input: CreateServiceProjectInput) {
    await ownedBusiness(userId, input.businessId);
    const client = await prisma.businessServiceClient.findFirst({ where: { id: input.clientId, businessId: input.businessId, isActive: true } });
    if (!client) throw AppError.badRequest("Service client does not belong to this business");
    return prisma.businessServiceProject.create({ data: input, include: { client: true } });
  },

  async createContract(userId: string, input: CreateServiceContractInput) {
    await ownedProject(userId, input.projectId);
    return prisma.businessServiceContract.create({ data: input });
  },

  async createTimesheet(userId: string, input: CreateTimesheetInput) {
    const project = await ownedProject(userId, input.projectId);
    return prisma.businessServiceTimesheet.create({ data: { ...input, userId, hourlyRate: input.hourlyRate || Number(project.hourlyRate) } });
  },

  async createExpense(userId: string, input: CreateServiceExpenseInput) {
    await ownedProject(userId, input.projectId);
    return prisma.businessServiceExpense.create({ data: input });
  },

  async profitability(userId: string, projectId: string) {
    const project = await ownedProject(userId, projectId);
    const [timesheets, expenses, invoices] = await Promise.all([
      prisma.businessServiceTimesheet.findMany({ where: { projectId } }),
      prisma.businessServiceExpense.findMany({ where: { projectId } }),
      prisma.businessServiceInvoice.findMany({ where: { projectId } }),
    ]);
    const laborCost = timesheets.reduce((sum, row) => sum + Number(row.hours) * Number(row.hourlyRate), 0);
    const expenseCost = expenses.reduce((sum, row) => sum + Number(row.amount), 0);
    const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    return { project, revenue: round2(revenue), laborCost: round2(laborCost), expenseCost: round2(expenseCost), totalCost: round2(laborCost + expenseCost), profit: round2(revenue - laborCost - expenseCost), billableHours: round2(timesheets.filter((row) => row.billable).reduce((sum, row) => sum + Number(row.hours), 0)) };
  },

  async milestones(userId: string, projectId: string) { await ownedProject(userId, projectId); return prisma.businessServiceMilestone.findMany({ where: { projectId }, orderBy: { dueDate: "asc" } }); },
  async createMilestone(userId: string, input: CreateMilestoneInput) { await ownedProject(userId, input.projectId); return prisma.businessServiceMilestone.create({ data: input }); },
  async createInvoice(userId: string, input: CreateServiceInvoiceInput) { await ownedProject(userId, input.projectId); return prisma.businessServiceInvoice.create({ data: input }); },
  async invoices(userId: string, projectId: string) { await ownedProject(userId, projectId); return prisma.businessServiceInvoice.findMany({ where: { projectId }, orderBy: { issueDate: "desc" } }); },
};
