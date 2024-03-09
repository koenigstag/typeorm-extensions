export type PageSize = number;

export type PageNumber = number; // 1-based index

export interface PaginationFilter {
  page?: PageNumber;
  pageSize?: PageSize;
}
