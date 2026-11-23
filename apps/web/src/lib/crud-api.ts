import { apiFetch } from "./api";

export type ListMeta = {
  total: number;
  page: number;
  pageSize: number;
};

export type ListResponse<T> = {
  data: T[];
  meta: ListMeta;
};

export type ItemResponse<T> = {
  data: T;
};

export type ListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
};

function toQuery(params?: ListParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function createCrudApi<TItem, TCreate = Partial<TItem>, TUpdate = Partial<TCreate>>(
  basePath: string,
) {
  return {
    list(params?: ListParams) {
      return apiFetch<ListResponse<TItem>>(`${basePath}${toQuery(params)}`);
    },
    get(id: string) {
      return apiFetch<ItemResponse<TItem>>(`${basePath}/${id}`);
    },
    create(body: TCreate) {
      return apiFetch<ItemResponse<TItem>>(basePath, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    update(id: string, body: TUpdate) {
      return apiFetch<ItemResponse<TItem>>(`${basePath}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    remove(id: string) {
      return apiFetch<void>(`${basePath}/${id}`, { method: "DELETE" });
    },
  };
}
