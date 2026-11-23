import type { ProjectCreateInput } from "@plexsol/shared";
import { createCrudApi } from "@/lib/crud-api";

export type Project = {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "ON_HOLD" | "CANCELLED";
  agreedPrice: string;
  currencyCode: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string; company: string | null };
};

export const projectsApi = createCrudApi<Project, ProjectCreateInput>(
  "/api/projects",
);
