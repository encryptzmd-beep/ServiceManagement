import { ProductMasterDTO } from '../../Models/ApiModels';
import { AutocompleteOption } from '../autocomplete-component/autocomplete-component';

/** The product master as autocomplete choices: name, "code · brand · model", and the rate (MRP) at the right. */
export function salesProductOptions(products: ProductMasterDTO[]): AutocompleteOption<number>[] {
  return products.map(p => ({
    value: p.productMasterId,
    label: p.productName,
    sub: [p.productCode, p.brand, p.model].map(v => (v ?? '').trim()).filter(Boolean).join(' · '),
    aside: '₹' + Number(p.mrp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  }));
}
