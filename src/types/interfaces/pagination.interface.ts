export type PageSize = number;

export type PageNumber = number; // counted from `firstPage`: 1 unless set to 0

export interface PaginationFilter {
  page?: PageNumber;
  pageSize?: PageSize;
}

/** A page given by the rows to skip and the rows to read, as `?offset=40&limit=20` gives it. */
export interface OffsetPaginationFilter {
  offset?: number;
  limit?: number;
}
