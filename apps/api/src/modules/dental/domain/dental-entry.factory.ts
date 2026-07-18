import { DentalChart } from './dental-chart.entity';
import { ToothVO } from './tooth.vo';
import { ToothStatus } from './tooth-status.enum';

export class DentalEntryFactory {
  static createEmptyChart(id: string, tenantId: string, patientId: string, mode: 'adult' | 'pediatric' = 'adult'): DentalChart {
    const count = mode === 'pediatric' ? 20 : 32;
    const teeth: ToothVO[] = [];
    for (let i = 1; i <= count; i++) teeth.push(new ToothVO(i, ToothStatus.Healthy, null, {}));
    return new DentalChart(id, tenantId, patientId, teeth, [], undefined, undefined, mode);
  }
}
