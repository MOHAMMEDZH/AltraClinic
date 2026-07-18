/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatusBadge, ProgressBar, EmptyState } from '../components/StatusParts';
import { CatalogPage } from '../pages/CatalogPage';

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { roles: ['owner'], tenantId: 't1', userId: 'u1' },
    getValidAccessToken: async () => 'token',
  }),
}));

vi.mock('../hooks/useImportExport', () => ({
  useImportExportCatalog: () => ({
    isLoading: false,
    isError: false,
    data: {
      featureEnabled: true,
      allowDataImport: true,
      allowDataExport: true,
      types: [
        {
          typeId: 'users-export',
          displayName: 'Users Export',
          category: 'identity',
          direction: 'export',
          ownerModule: 'users',
          version: '1.0.0',
          status: 'active',
          registrationKind: 'exporter',
          supportedFormats: ['csv', 'xlsx'],
          supportsDryRun: false,
          supportsPreview: true,
          requiredPermission: { resource: 'api.importExport', action: 'export' },
          requiredLicense: 'allowDataExport',
          tenantScope: 'tenant',
          branchScope: 'tenant',
          featureFlag: null,
          adapterAttached: true,
          executable: true,
          visible: true,
        },
      ],
      meta: {
        registeredCount: 7,
        visibleCount: 1,
        disabledCount: 0,
        inactiveCount: 0,
        invalidCount: 0,
        executableCount: 1,
        adapterAttachedCount: 1,
      },
    },
  }),
}));

describe('StatusParts', () => {
  it('renders status, progress, and empty state accessibly', () => {
    render(
      <>
        <StatusBadge status="completed" />
        <ProgressBar percent={40} label="Generating" />
        <EmptyState title="Nothing here" detail="Try again" />
      </>,
    );
    expect(screen.getByText('completed')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('CatalogPage', () => {
  it('renders catalog rows from EffectiveImportExportView payload', () => {
    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Runtime catalog')).toBeTruthy();
    expect(screen.getByText('Users Export')).toBeTruthy();
    expect(screen.getByText('users-export')).toBeTruthy();
    expect(screen.getByText('csv, xlsx')).toBeTruthy();
  });
});
