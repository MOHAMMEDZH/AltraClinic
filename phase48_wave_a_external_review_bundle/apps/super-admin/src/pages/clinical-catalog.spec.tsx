import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { ClinicalCatalogPage } from './ClinicalCatalogPage';

const listClinicalCatalogServices = vi.fn();
const createClinicalCatalogServiceDraft = vi.fn();
const publishClinicalCatalogService = vi.fn();

let permissions: string[] = ['clinical_catalog.admin'];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        listClinicalCatalogServices,
        createClinicalCatalogServiceDraft,
        publishClinicalCatalogService,
        deprecateClinicalCatalogService: vi.fn(),
        inactivateClinicalCatalogService: vi.fn(),
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

describe('ClinicalCatalogPage', () => {
  beforeEach(() => {
    permissions = ['clinical_catalog.admin'];
    listClinicalCatalogServices.mockResolvedValue([
      {
        id: 'svc-1',
        stableKey: 'canonical.general.consultation',
        provenance: 'SYSTEM_CANONICAL',
        domain: 'GENERAL',
        categoryKey: null,
        defaultDurationMin: 30,
        lifecycle: 'PUBLISHED',
        tenantId: null,
        translations: [
          { locale: 'en', displayName: 'Consultation' },
          { locale: 'ar', displayName: 'استشارة' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders clinical services list with EN/AR names', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <ClinicalCatalogPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText('Consultation')).toBeTruthy();
    expect(screen.getByText('استشارة')).toBeTruthy();
    expect(screen.getByText('canonical.general.consultation')).toBeTruthy();
    expect(screen.getByText(/Clinical catalog only/i)).toBeTruthy();
  });

  it('shows permission warning without clinical_catalog.admin', async () => {
    permissions = [];
    render(
      <AppProviders>
        <MemoryRouter>
          <ClinicalCatalogPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(/Permission limited/i)).toBeTruthy();
    expect(listClinicalCatalogServices).not.toHaveBeenCalled();
  });

  it('opens create draft form', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <ClinicalCatalogPage />
        </MemoryRouter>
      </AppProviders>,
    );

    await screen.findByText('Consultation');
    fireEvent.click(screen.getByRole('button', { name: /Create draft/i }));
    expect(screen.getByLabelText(/Stable key/i)).toBeTruthy();
  });
});
