/** The fields of a work order that decide whether it may close without a bill. */
export interface ChargeableJob {
  isWarranty?: boolean | null;
  natureOfJob?: string | null;
}

/**
 * A warranty job, or the installation raised by a despatch (always IsWarranty = 1),
 * is done free of charge: the technician may complete it without recording a
 * payment. Any other job still needs its final payment first.
 */
export function isNoChargeJob(wo: ChargeableJob | null | undefined): boolean {
  if (!wo) return false;
  if (wo.isWarranty === true) return true;
  return (wo.natureOfJob ?? '').trim().toLowerCase() === 'installation';
}
