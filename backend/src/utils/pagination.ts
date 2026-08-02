import { Request } from "express";

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
  search?: string;
  sortBy?: string;
  sortDir: "asc" | "desc";
}

/** Parses common `?page&limit&search&sortBy&sortDir` query params with sane defaults/bounds. */
export function parsePagination(req: Request, defaultSortBy = "createdAt"): PaginationParams {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
  const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim() : undefined;
  const sortBy = typeof req.query.sortBy === "string" && req.query.sortBy.trim() ? req.query.sortBy.trim() : defaultSortBy;
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    search,
    sortBy,
    sortDir,
  };
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
