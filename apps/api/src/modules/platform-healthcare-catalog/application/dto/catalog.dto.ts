export interface CatalogTranslationDto {
  readonly locale: string;
  readonly displayName: string;
  readonly shortDescription: string;
  readonly longDescription: string | null;
  readonly helpText: string | null;
  readonly incomplete: boolean;
}

export interface CatalogAliasDto {
  readonly id: string;
  readonly aliasValue: string;
  readonly sourceNamespace: string;
  readonly lifecycle: string;
  readonly reason: string | null;
}

export interface CatalogLimitMetaDto {
  readonly valueType: string;
  readonly unit: string;
  readonly min: string | null;
  readonly max: string | null;
  readonly zeroValid: boolean;
  readonly unlimitedSupported: boolean;
}

export interface CatalogItemListItemDto {
  readonly id: string;
  readonly canonicalKey: string;
  readonly kind: string;
  readonly lifecycle: string;
  readonly sortOrder: number;
  readonly version: number;
  readonly systemSeeded: boolean;
  readonly displayName: string;
  readonly missingTranslations: string[];
  readonly referenceCount: number;
}

export interface CatalogItemDetailDto {
  readonly id: string;
  readonly canonicalKey: string;
  readonly kind: string;
  readonly lifecycle: string;
  readonly sortOrder: number;
  readonly iconKey: string | null;
  readonly parentCanonicalKey: string | null;
  readonly owningModuleCanonicalKey: string | null;
  readonly version: number;
  readonly systemSeeded: boolean;
  readonly replacementCanonicalKey: string | null;
  readonly translations: CatalogTranslationDto[];
  readonly aliases: CatalogAliasDto[];
  readonly limit: CatalogLimitMetaDto | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CatalogListResponseDto {
  readonly generatedAt: string;
  readonly items: CatalogItemListItemDto[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly hasNextPage: boolean;
  };
}

export interface CatalogRuleDto {
  readonly id: string;
  readonly ruleType: string;
  readonly subjectKey: string;
  readonly targetKey: string;
  readonly anyOfGroupKey: string;
  readonly lifecycle: string;
  readonly explanationEn: string;
  readonly explanationAr: string;
  readonly version: number;
  readonly systemSeeded: boolean;
}

export interface CatalogReferenceBucketDto {
  readonly sourceType: string;
  readonly count: number;
  readonly availability: 'available' | 'unavailable';
  readonly reasonCode?: string;
  readonly keys?: string[];
}

export interface CatalogReferencesDto {
  readonly itemId: string;
  readonly canonicalKey: string;
  readonly buckets: CatalogReferenceBucketDto[];
}

export interface ValidateSelectionRequestDto {
  readonly facilityTypeKey?: string;
  readonly specialtyKeys?: string[];
  readonly moduleKeys?: string[];
  readonly featureKeys?: string[];
  readonly limitKeys?: string[];
}

export interface CreateCatalogItemRequestDto {
  readonly kind: string;
  readonly canonicalKey: string;
  readonly sortOrder?: number;
  readonly iconKey?: string;
  readonly parentCanonicalKey?: string | null;
  readonly owningModuleCanonicalKey?: string | null;
  readonly translations: Array<{
    locale: string;
    displayName: string;
    shortDescription: string;
    longDescription?: string;
    helpText?: string;
  }>;
  readonly limit?: {
    valueType: string;
    unit: string;
    min?: number;
    max?: number;
    zeroValid: boolean;
    unlimitedSupported: boolean;
  };
}

export interface UpdateCatalogItemRequestDto {
  readonly expectedVersion: number;
  readonly sortOrder?: number;
  readonly iconKey?: string | null;
  readonly parentCanonicalKey?: string | null;
  readonly owningModuleCanonicalKey?: string | null;
  readonly translations?: Array<{
    locale: string;
    displayName: string;
    shortDescription: string;
    longDescription?: string | null;
    helpText?: string | null;
  }>;
  readonly limit?: {
    valueType: string;
    unit: string;
    min?: number | null;
    max?: number | null;
    zeroValid: boolean;
    unlimitedSupported: boolean;
  };
}

export interface AddCatalogAliasRequestDto {
  readonly aliasValue: string;
  readonly sourceNamespace: string;
  readonly reason?: string;
  readonly expectedVersion: number;
}

export interface RetireCatalogAliasRequestDto {
  readonly expectedVersion: number;
  readonly reason: string;
}

export interface LifecycleTransitionRequestDto {
  readonly expectedVersion: number;
  readonly reason: string;
  readonly replacementCanonicalKey?: string;
}
