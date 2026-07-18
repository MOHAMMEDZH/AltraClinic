import { AiPolicy } from '../policies/ai-policy.service';

describe('AiPolicy', () => {
  const policy = new AiPolicy();

  describe('canManageModels (authoring tier)', () => {
    it.each(['admin', 'tenant_admin', 'ai_admin', 'ai_manager'])('allows %s', (role) => {
      expect(policy.canManageModels([role])).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(policy.canManageModels(['AI_Manager'])).toBe(true);
    });

    it('rejects unrelated roles', () => {
      expect(policy.canManageModels(['patient', 'clinician'])).toBe(false);
    });

    it('rejects an empty role set', () => {
      expect(policy.canManageModels([])).toBe(false);
    });
  });

  describe('canReviewModels (governance review tier)', () => {
    it.each(['admin', 'tenant_admin', 'ai_admin'])('allows %s', (role) => {
      expect(policy.canReviewModels([role])).toBe(true);
    });

    it('denies the authoring-only role (separation of duties)', () => {
      expect(policy.canReviewModels(['ai_manager'])).toBe(false);
    });
  });

  describe('canOperateModels (governance operations tier)', () => {
    it.each(['admin', 'tenant_admin', 'ai_admin'])('allows %s', (role) => {
      expect(policy.canOperateModels([role])).toBe(true);
    });

    it('denies the authoring-only role (separation of duties)', () => {
      expect(policy.canOperateModels(['ai_manager'])).toBe(false);
    });
  });
});
