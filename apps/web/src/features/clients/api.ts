import type { ClientCreateInput } from "@plexsol/shared";
import { createCrudApi } from "@/lib/crud-api";

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number; payments?: number };
  projects?: Array<{
    id: string;
    name: string;
    status: string;
    agreedPrice: string;
    currencyCode: string;
  }>;
};

export const clientsApi = createCrudApi<Client, ClientCreateInput>(
  "/api/clients",
);
