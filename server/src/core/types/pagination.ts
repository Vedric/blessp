export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/**
 * Parses and normalizes pagination parameters from query strings.
 * Enforces a maximum of 100 items per page and a minimum page of 1.
 */
export function parsePagination(query: {
  page?: string | number;
  perPage?: string | number;
}): PaginationParams {
  let page = Number(query.page) || DEFAULT_PAGE;
  let perPage = Number(query.perPage) || DEFAULT_PER_PAGE;

  if (page < 1) page = DEFAULT_PAGE;
  if (perPage < 1) perPage = DEFAULT_PER_PAGE;
  if (perPage > MAX_PER_PAGE) perPage = MAX_PER_PAGE;

  return { page, perPage };
}

/**
 * Computes the skip offset for database queries based on pagination params.
 */
export function computeSkip(params: PaginationParams): number {
  return (params.page - 1) * params.perPage;
}

/**
 * Builds a PaginationMeta object from the parameters and total count.
 */
export function buildPaginationMeta(
  params: PaginationParams,
  totalItems: number,
): PaginationMeta {
  return {
    page: params.page,
    perPage: params.perPage,
    totalItems,
    totalPages: Math.ceil(totalItems / params.perPage) || 1,
  };
}
