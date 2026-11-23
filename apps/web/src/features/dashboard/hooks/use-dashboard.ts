import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getDashboardSnapshot } from "../data/repository";

export function useDashboard(initialPeriodId = "2025-01") {
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
