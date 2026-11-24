import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getDashboardSnapshot } from "../data/repository";

function defaultPeriodId() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function useDashboard(initialPeriodId = defaultPeriodId()) {
  const [periodId, setPeriodId] = useState(initialPeriodId);

  const query = useQuery({
    queryKey: ["dashboard", periodId],
    queryFn: () => getDashboardSnapshot(periodId),
    staleTime: 30_000,
  });

  return {
    periodId,
    setPeriodId,
    ...query,
  };
}
