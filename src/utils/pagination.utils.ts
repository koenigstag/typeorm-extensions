import { defaultPageSize } from "../constants";
import { PaginationFilter } from "../types/interfaces/pagination.interface";

// an unparsed query parameter is a string: "20" + 1 would be "201"
const toPositiveInteger = (value: unknown, fallback: number): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

  return typeof number === 'number' && Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback;
};

/** The page size to read: a number or a numeric string of at least 1, rounded down; `defaultPageSize` otherwise. */
export const normalizePageSize = (pageSize: unknown): number => toPositiveInteger(pageSize, defaultPageSize);

export const getLimitAndOffset = ({ page, pageSize }: PaginationFilter) => {
  const normalizedPage = toPositiveInteger(page, 1);
  const normalizedPageSize = normalizePageSize(pageSize);

  return {
    limit: normalizedPageSize,
    offset: (normalizedPage - 1) * normalizedPageSize,
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
};
