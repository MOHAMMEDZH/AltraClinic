import { describe, expect, it } from 'vitest';
import { buildPatientWordBuffer } from './build-patient-word';

describe('build-patient-word', () => {
  it('builds a non-empty docx buffer', async () => {
    const buffer = await buildPatientWordBuffer(
      {
        title: 'Patient summary',
        subtitle: 'Sarah Hassan · 2026-06-15',
        sections: [
          {
            title: 'Demographics',
            rows: [
              ['Date of birth', '1990-04-12'],
              ['Gender', 'Female'],
            ],
          },
        ],
        notesTitle: 'Notes',
        notes: 'Follow up in two weeks.',
      },
      'en-US',
    );

    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
