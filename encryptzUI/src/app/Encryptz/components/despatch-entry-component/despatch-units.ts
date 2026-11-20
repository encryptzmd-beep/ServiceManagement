/** The fields of a bill line that decide whether it is despatched as product units. */
export interface BillLine {
  productMasterId?: number | null;
  warrantyMonths?: number | null;
}

/**
 * A bill line becomes units (one serial number and warranty each) unless it is a
 * service line: typed in without a product from the master and carrying no warranty,
 * e.g. "Installation and delivery". dbo.sp_Despatch_Create applies the same rule.
 */
export function isProductLine(line: BillLine): boolean {
  return !!line.productMasterId || (Number(line.warrantyMonths) || 0) > 0;
}
