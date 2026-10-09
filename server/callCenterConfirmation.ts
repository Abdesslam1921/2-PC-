export const CONFIRMATION_COST_STATUSES = new Set([
  "confirmed",
  "processing",
  "at_carrier",
  "shipped",
  "delivered",
]);

export function hasDefinedCommission(
  generalOrderRate: string | number | null | undefined,
  completedOrderRate: string | number | null | undefined
) {
  return Number(generalOrderRate ?? 0) > 0 || Number(completedOrderRate ?? 0) > 0;
}

export function shouldSnapshotAgentConfirmation(input: {
  nextStatus: string;
  alreadyCallCenter: boolean;
}) {
  if (input.alreadyCallCenter) return false;
  return CONFIRMATION_COST_STATUSES.has(input.nextStatus);
}

export function confirmationCostCentsForOrder(
  items: Array<{
    confirmationSource?: string | null;
    normalConfirmationCostSnapshot?: string | number | null;
    deliveredConfirmationCostSnapshot?: string | number | null;
  }>,
  isDelivered: boolean
) {
  const costed = items.find(item => item.confirmationSource === "call_center");
  if (!costed) return 0;
  const raw = isDelivered
    ? costed.deliveredConfirmationCostSnapshot
    : costed.normalConfirmationCostSnapshot;
  return Math.round((Number(raw ?? 0) || 0) * 100);
}
