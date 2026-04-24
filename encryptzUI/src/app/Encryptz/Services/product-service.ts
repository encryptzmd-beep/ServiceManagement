// services/product.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, ProductMaster, PaginatedResult, DropdownData, BulkOperationDto, BulkUpdateStatusDto, ProductMasterDTO, ProductMasterRequest } from '../Models/ApiModels';
import { environment } from '../../../environments/environment.development';


@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = `${environment.apiUrl}/api/ProductMaster`;
private http = inject(HttpClient);


  createProduct(product: ProductMasterRequest): Observable<ApiResponse<ProductMasterDTO>> {
    return this.http.post<ApiResponse<ProductMasterDTO>>(`${this.apiUrl}/create`, product);
  }

  updateProduct(id: number, product: ProductMasterRequest): Observable<ApiResponse<ProductMaster>> {
    return this.http.put<ApiResponse<ProductMasterDTO>>(`${this.apiUrl}/${id}/update`, product);
  }

  deleteProduct(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.apiUrl}/${id}/delete`);
  }

  getProductById(id: number): Observable<ApiResponse<ProductMasterDTO>> {
    return this.http.get<ApiResponse<ProductMasterDTO>>(`${this.apiUrl}/${id}`);
  }
getAllProducts(request: ProductMasterRequest) {
  let params = new HttpParams()
    .set('pageNumber', request.pageNumber.toString())
    .set('pageSize', request.pageSize.toString())
    .set('sortColumn', request.sortColumn)
    .set('sortDirection', request.sortDirection);

  if (request.searchTerm?.trim()) {
    params = params.set('searchTerm', request.searchTerm.trim());
  }

  if (request.category) {
    params = params.set('category', request.category);
  }

  if (request.subCategory) {
    params = params.set('subCategory', request.subCategory);
  }

  return this.http.get<ApiResponse<PaginatedResult<ProductMasterDTO>>>(
    `${this.apiUrl}/all`,
    { params }
  );
}

  getProductList(searchTerm?: string, page: number = 1, pageSize: number = 50): Observable<ProductMasterDTO[]> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }

    return this.http.get<ProductMasterDTO[]>(`${this.apiUrl}/list`, { params });
  }

  getDropdowns(): Observable<ApiResponse<DropdownData>> {
    return this.http.get<ApiResponse<DropdownData>>(`${this.apiUrl}/dropdowns`);
  }

  bulkDeleteProducts(ids: number[]): Observable<ApiResponse<boolean>> {
    const dto: BulkOperationDto = { ids };
    return this.http.post<ApiResponse<boolean>>(`${this.apiUrl}/bulk-delete`, dto);
  }

  bulkUpdateStatus(ids: number[], isActive: boolean): Observable<ApiResponse<boolean>> {
    const dto: BulkUpdateStatusDto = { ids, isActive };
    return this.http.post<ApiResponse<boolean>>(`${this.apiUrl}/bulk-update-status`, dto);
  }
}
