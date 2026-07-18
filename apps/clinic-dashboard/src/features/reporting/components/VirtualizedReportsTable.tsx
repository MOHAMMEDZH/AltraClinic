import { useMemo } from 'react';

import { Link } from 'react-router-dom';

import { FixedSizeList, type ListChildComponentProps } from 'react-window';

import { useI18n } from '@booking/i18n/react';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { Download } from 'lucide-react';

import styles from '../reporting-layout.module.css';



export interface ReportTableRow {

  id: string;

  name: string;

  type: string;

  format: string;

  status: string;

  createdAt: string;

  canDownload?: boolean;

  detailPath?: string;

}



interface VirtualizedReportsTableProps {

  rows: ReportTableRow[];

  onDownload?: (row: ReportTableRow) => void;

  downloading?: boolean;

  height?: number;

}



const ROW_HEIGHT = 52;



export function VirtualizedReportsTable({

  rows,

  onDownload,

  downloading,

  height = 420,

}: VirtualizedReportsTableProps) {

  const { t } = useI18n();



  const itemData = useMemo(

    () => ({ rows, onDownload, downloading, t }),

    [rows, onDownload, downloading, t],

  );



  if (rows.length === 0) {

    return <p className={styles.empty}>{t('reports.export.empty')}</p>;

  }



  return (

    <div className={styles.virtualTableWrap} role="region" aria-label={t('reports.export.title')}>

      <div className={styles.virtualTableHeader} role="row">

        <span role="columnheader">{t('reports.export.name')}</span>

        <span role="columnheader">{t('reports.export.type')}</span>

        <span role="columnheader">{t('reports.export.format')}</span>

        <span role="columnheader">{t('reports.export.status')}</span>

        <span role="columnheader">{t('reports.export.actions')}</span>

      </div>

      <FixedSizeList

        height={Math.min(height, rows.length * ROW_HEIGHT + 8)}

        itemCount={rows.length}

        itemSize={ROW_HEIGHT}

        width="100%"

        itemData={itemData}

      >

        {ReportRow}

      </FixedSizeList>

    </div>

  );

}



function ReportRow({ index, style, data }: ListChildComponentProps<{

  rows: ReportTableRow[];

  onDownload?: (row: ReportTableRow) => void;

  downloading?: boolean;

  t: (key: string) => string;

}>) {

  const row = data.rows[index];

  const detailPath = row.detailPath ?? `/reports/${row.id}`;

  return (

    <div style={style} className={styles.virtualTableRow} role="row">

      <span role="cell">

        <Link to={detailPath} className={styles.cardAction}>{row.name}</Link>

      </span>

      <span role="cell">{row.type}</span>

      <span role="cell">{row.format.toUpperCase()}</span>

      <span role="cell">{row.status}</span>

      <span role="cell">

        {row.canDownload && data.onDownload && (

          <AuthButton variant="secondary" loading={data.downloading} onClick={() => data.onDownload?.(row)}>

            <Download size={16} aria-hidden /> {data.t('reports.export.download')}

          </AuthButton>

        )}

      </span>

    </div>

  );

}

