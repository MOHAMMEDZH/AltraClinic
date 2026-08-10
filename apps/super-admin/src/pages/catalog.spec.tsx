import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { CatalogPage } from './CatalogPage';

const listHealthcareCatalogItems = vi.fn();
const getHealthcareCatalogDriftReport = vi.fn();
const validateHealthcareCatalogSelection = vi.fn();
const getHealthcareCatalogItem = vi.fn();
const createHealthcareCatalogItem = vi.fn();
const updateHealthcareCatalogItem = vi.fn();
const activateHealthcareCatalogItem = vi.fn();
const getHealthcareCatalogItemReferences = vi.fn();
const listHealthcareCatalogCompatibilityRules = vi.fn();
const createHealthcareCatalogCompatibilityRule = vi.fn();

let permissions: string[] = [
  'facility-type.view',
  'specialty.view',
  'module.view',
  'feature.view',
  'limit.view',
  'compatibility-rule.view',
];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        listHealthcareCatalogItems,
        getHealthcareCatalogDriftReport,
        validateHealthcareCatalogSelection,
        getHealthcareCatalogItem,
        createHealthcareCatalogItem,
        updateHealthcareCatalogItem,
        activateHealthcareCatalogItem,
        getHealthcareCatalogItemReferences,
        listHealthcareCatalogCompatibilityRules,
        createHealthcareCatalogCompatibilityRule,
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

describe('CatalogPage', () => {
  beforeEach(() => {
    permissions = [
      'facility-type.view',
      'specialty.view',
      'module.view',
      'feature.view',
      'limit.view',
      'compatibility-rule.view',
    ];
    listHealthcareCatalogItems.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      items: [
        {
          id: '1',
          canonicalKey: 'facility_type.dental_clinic',
          kind: 'FACILITY_TYPE',
          lifecycle: 'ACTIVE',
          sortOrder: 1,
          version: 1,
          systemSeeded: true,
          displayName: 'Dental clinic',
          missingTranslations: [],
          referenceCount: 2,
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, hasNextPage: false },
    });
    getHealthcareCatalogDriftReport.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      summary: { errors: 0, warnings: 0, ignored: 1 },
      findings: [],
    });
    listHealthcareCatalogCompatibilityRules.mockResolvedValue({ items: [] });
    getHealthcareCatalogItemReferences.mockResolvedValue({
      itemId: '1',
      canonicalKey: 'facility_type.dental_clinic',
      buckets: [
        { sourceType: 'aliases', count: 1, availability: 'available' },
        {
          sourceType: 'plan_references',
          count: 0,
          availability: 'unavailable',
          reasonCode: 'step13_plans',
        },
      ],
    });
    getHealthcareCatalogItem.mockResolvedValue({
      id: '1',
      canonicalKey: 'facility_type.dental_clinic',
      kind: 'FACILITY_TYPE',
      lifecycle: 'DRAFT',
      sortOrder: 1,
      iconKey: 'dental',
      parentCanonicalKey: null,
      owningModuleCanonicalKey: null,
      version: 1,
      systemSeeded: true,
      replacementCanonicalKey: null,
      translations: [
        {
          locale: 'en-US',
          displayName: 'Dental clinic',
          shortDescription: 'Dental',
          longDescription: null,
          helpText: null,
          incomplete: false,
        },
        {
          locale: 'ar-SY',
          displayName: 'عيادة أسنان',
          shortDescription: 'أسنان',
          longDescription: null,
          helpText: null,
          incomplete: false,
        },
      ],
      aliases: [],
      limit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders catalog list with canonical key as data and no delete control', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <CatalogPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText('Dental clinic')).toBeTruthy();
    expect(screen.getByText('facility_type.dental_clinic')).toBeTruthy();
    expect(screen.getByText(/Catalog metadata only/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('hides create and lifecycle mutation controls for read-only users', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <CatalogPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText('Dental clinic')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Create item/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Open/i }));
    await waitFor(() => expect(getHealthcareCatalogItem).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /^Activate$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Retire$/i })).toBeNull();
  });

  it('shows create for kind manage permission and opens confirmation on activate', async () => {
    permissions = [
      'facility-type.view',
      'facility-type.manage',
      'specialty.view',
      'module.view',
      'feature.view',
      'limit.view',
      'compatibility-rule.view',
      'compatibility-rule.manage',
    ];
    activateHealthcareCatalogItem.mockResolvedValue({
      id: '1',
      canonicalKey: 'facility_type.dental_clinic',
      kind: 'FACILITY_TYPE',
      lifecycle: 'ACTIVE',
      sortOrder: 1,
      iconKey: null,
      parentCanonicalKey: null,
      owningModuleCanonicalKey: null,
      version: 2,
      systemSeeded: true,
      replacementCanonicalKey: null,
      translations: [],
      aliases: [],
      limit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(
      <AppProviders>
        <MemoryRouter>
          <CatalogPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByRole('button', { name: /Create item/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    await waitFor(() => expect(getHealthcareCatalogItem).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^Activate$/i }));
    expect(await screen.findByText(/Activate catalog item/i)).toBeTruthy();
    expect(activateHealthcareCatalogItem).not.toHaveBeenCalled();
    const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]!);
    expect(activateHealthcareCatalogItem).not.toHaveBeenCalled();
  });
});
