import { queryOptions } from "@tanstack/react-query";
import { getBoard } from "./vouchers.functions";

export const boardQuery = queryOptions({
  queryKey: ["board"],
  queryFn: () => getBoard(),
  staleTime: 30_000,
});
