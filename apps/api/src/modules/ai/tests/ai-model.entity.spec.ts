import { AiModel } from '../domain/entities/ai-model.entity';
import { AiDomainError } from '../domain/exceptions/ai-domain.exception';

describe('AiModel entity', () => {
  const baseParams = {
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    nameEn: 'Patient Summary',
    nameAr: 'ملخص المريض',
    descriptionEn: 'AI-generated patient summaries',
    descriptionAr: 'ملخصات المرضى المولدة بالذكاء الاصطناعي',
    modelType: 'summary' as const,
    version: '1.0.0',
    createdBy: 'user-1',
  };

  it('creates a model in draft status', () => {
    const model = AiModel.create(baseParams);
    expect(model.status.value).toBe('draft');
    expect(model.deployedAt).toBeNull();
    expect(model.retiredAt).toBeNull();
    expect(model.id).toBeDefined();
  });

  it('trims whitespace on creation', () => {
    const model = AiModel.create({ ...baseParams, nameEn: '  Trimmed  ', version: ' 2.0.0 ' });
    expect(model.nameEn).toBe('Trimmed');
    expect(model.version).toBe('2.0.0');
  });

  it.each([
    ['nameEn', 'English model name is required'],
    ['nameAr', 'Arabic model name is required'],
    ['descriptionEn', 'English model description is required'],
    ['descriptionAr', 'Arabic model description is required'],
    ['version', 'Model version is required'],
    ['createdBy', 'CreatedBy is required'],
  ])('throws when %s is missing', (field, message) => {
    expect(() => AiModel.create({ ...baseParams, [field]: '   ' } as any)).toThrow(message);
  });

  it('validates a draft model by a different user than the creator', () => {
    const model = AiModel.create(baseParams);
    model.validate('reviewer-1', 'looks good');
    expect(model.status.value).toBe('validated');
    expect(model.validatedBy).toBe('reviewer-1');
    expect(model.validationNotes).toBe('looks good');
    expect(model.validatedAt).not.toBeNull();
  });

  it('cannot be validated by the same user who created it (separation of duties)', () => {
    const model = AiModel.create(baseParams);
    expect(() => model.validate(baseParams.createdBy)).toThrow(
      'A model cannot be validated by the same user who created it',
    );
  });

  it('requires validatedBy to validate', () => {
    const model = AiModel.create(baseParams);
    expect(() => model.validate('  ')).toThrow(AiDomainError);
  });

  it('cannot validate an already validated model', () => {
    const model = AiModel.create(baseParams);
    model.validate('reviewer-1');
    expect(() => model.validate('reviewer-2')).toThrow('Model is already validated');
  });

  it('deploys a validated model', () => {
    const model = AiModel.create(baseParams);
    model.validate('reviewer-1');
    model.deploy('deployer-1');
    expect(model.status.value).toBe('deployed');
    expect(model.deployedBy).toBe('deployer-1');
    expect(model.deployedAt).not.toBeNull();
  });

  it('cannot deploy a model that has not been validated', () => {
    const model = AiModel.create(baseParams);
    expect(() => model.deploy('deployer-1')).toThrow('Model must be validated before it can be deployed');
  });

  it('requires deployedBy to deploy', () => {
    const model = AiModel.create(baseParams);
    model.validate('reviewer-1');
    expect(() => model.deploy('  ')).toThrow(AiDomainError);
  });

  it('cannot deploy an already deployed model', () => {
    const model = AiModel.create(baseParams);
    model.validate('reviewer-1');
    model.deploy('deployer-1');
    expect(() => model.deploy('deployer-2')).toThrow('Model is already deployed');
  });

  it('cannot deploy a retired model', () => {
    const model = AiModel.create(baseParams);
    model.retire('retirer-1');
    expect(() => model.deploy('deployer-1')).toThrow('Retired models cannot be deployed');
  });

  it('cannot validate a retired model', () => {
    const model = AiModel.create(baseParams);
    model.retire('retirer-1');
    expect(() => model.validate('reviewer-1')).toThrow('Retired models cannot be validated');
  });

  it('retires a model', () => {
    const model = AiModel.create(baseParams);
    model.retire('retirer-1');
    expect(model.status.value).toBe('retired');
    expect(model.retiredAt).not.toBeNull();
  });

  it('requires retiredBy to retire', () => {
    const model = AiModel.create(baseParams);
    expect(() => model.retire('  ')).toThrow(AiDomainError);
  });

  it('cannot retire an already retired model', () => {
    const model = AiModel.create(baseParams);
    model.retire('retirer-1');
    expect(() => model.retire('retirer-2')).toThrow('Model is already retired');
  });

  it('serializes to primitives', () => {
    const model = AiModel.create(baseParams);
    const primitives = model.toPrimitives();
    expect(primitives.modelId).toBe(model.id);
    expect(primitives.status).toBe('draft');
    expect(primitives.deployedAt).toBeNull();
    expect(primitives.retiredAt).toBeNull();
  });
});
