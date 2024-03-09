import { defaultPageSize } from "../constants";
import { PaginationFilter } from "../types/interfaces/pagination.interface";

export const getLimitAndOffset = ({ page, pageSize}: PaginationFilter) => {
  if (!page || page < 1) {
    page = 1;
  }

  if (!pageSize || pageSize < 1) {
    pageSize = defaultPageSize;
  }

  const offset = (page >= 1 ? page - 1 : 0) * pageSize;
  const limit = pageSize;

  return { limit, offset };
}