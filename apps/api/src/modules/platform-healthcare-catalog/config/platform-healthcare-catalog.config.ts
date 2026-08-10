export interface PlatformHealthcareCatalogConfig {
  readonly defaultPageSize: number;
  readonly maxPageSize: number;
  readonly maxSearchLength: number;
}

export const loadPlatformHealthcareCatalogConfig = (): PlatformHealthcareCatalogConfig => ({
  defaultPageSize: 25,
  maxPageSize: 100,
  maxSearchLength: 64,
});
