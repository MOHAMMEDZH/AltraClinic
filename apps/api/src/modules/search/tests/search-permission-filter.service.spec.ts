import { SearchPermissionFilterService } from '../application/services/search-permission-filter.service';
import { ALL_SEARCH_ENTITY_TYPES, SEARCH_ENTITY_TYPES } from '../domain/search.types';

describe('SearchPermissionFilterService', () => {
  const filter = new SearchPermissionFilterService();

  it('allows receptionist to search patients and appointments but not billing', () => {
    const roles = ['receptionist'];
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.PATIENT, roles)).toBe(true);
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.APPOINTMENT, roles)).toBe(true);
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.INVOICE, roles)).toBe(false);
  });

  it('allows accountant to search invoices and inventory', () => {
    const roles = ['accountant'];
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.INVOICE, roles)).toBe(true);
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.INVENTORY, roles)).toBe(true);
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.DIAGNOSIS, roles)).toBe(false);
  });

  it('allows treatment search when user has dental or beauty access', () => {
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.TREATMENT, ['dentist'])).toBe(true);
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.TREATMENT, ['specialist'])).toBe(true);
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.TREATMENT, ['receptionist'])).toBe(true);
    expect(filter.canViewEntityType(SEARCH_ENTITY_TYPES.TREATMENT, ['accountant'])).toBe(false);
  });

  it('filters requested types to allowed subset', () => {
    const result = filter.filterTypes(
      [SEARCH_ENTITY_TYPES.PATIENT, SEARCH_ENTITY_TYPES.INVOICE],
      ['receptionist'],
    );
    expect(result).toEqual([SEARCH_ENTITY_TYPES.PATIENT]);
  });

  it('grants all types to super_admin', () => {
    const allowed = filter.resolveAllowedTypes(['super_admin']);
    expect(allowed.length).toBe(ALL_SEARCH_ENTITY_TYPES.length);
  });
});
