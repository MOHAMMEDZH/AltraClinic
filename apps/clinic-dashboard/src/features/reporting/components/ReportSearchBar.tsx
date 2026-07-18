import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import styles from '../reporting-layout.module.css';

interface ReportSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categories: Array<{ id: string; labelKey: string }>;
  showCategorySelect?: boolean;
}

export function ReportSearchBar({
  value,
  onChange,
  category,
  onCategoryChange,
  categories,
  showCategorySelect = true,
}: ReportSearchBarProps) {
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);

  const ariaDesc = useMemo(() => t('reports.search.hint'), [t]);

  return (
    <div className={styles.searchBar} role="search" aria-label={t('reports.search.label')}>
      <label className={styles.searchInputWrap}>
        <Search size={18} aria-hidden className={styles.searchIcon} />
        <input
          type="search"
          value={value}
          placeholder={t('reports.search.placeholder')}
          aria-describedby="report-search-hint"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <span id="report-search-hint" className={focused ? styles.srOnly : styles.srOnly}>
        {ariaDesc}
      </span>
      <select
        value={category}
        aria-label={t('reports.search.category')}
        onChange={(e) => onCategoryChange(e.target.value)}
        className={styles.categorySelect}
        hidden={!showCategorySelect}
        aria-hidden={!showCategorySelect}
      >
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {t(cat.labelKey as 'reports.categories.all')}
          </option>
        ))}
      </select>
    </div>
  );
}
