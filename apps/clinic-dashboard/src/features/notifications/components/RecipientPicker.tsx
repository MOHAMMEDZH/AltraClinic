import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchUsers, type UserSummary } from '@/features/user-management/api/identity-api';
import styles from '../notifications-layout.module.css';

interface RecipientPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  id?: string;
}

export function RecipientPicker({ value, onChange, id }: RecipientPickerProps) {
  const { t } = useI18n();
  const { getValidAccessToken, user } = useAuth();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UserSummary[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open || debounced.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const token = await getValidAccessToken();
        if (!token || !user?.tenantId || cancelled) return;
        const res = await fetchUsers(token, user.tenantId, { search: debounced, limit: 10, status: 'active' });
        if (!cancelled) {
          setResults(res.items.filter((u) => !value.includes(u.id)));
          setLabels((prev) => {
            const next = { ...prev };
            for (const u of res.items) next[u.id] = u.fullName || u.email;
            return next;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, debounced, getValidAccessToken, user?.tenantId, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const addRecipient = (userItem: UserSummary) => {
    if (value.includes(userItem.id)) return;
    setLabels((prev) => ({ ...prev, [userItem.id]: userItem.fullName || userItem.email }));
    onChange([...value, userItem.id]);
    setQuery('');
    setDebounced('');
    setOpen(false);
  };

  const removeRecipient = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div className={styles.recipientPicker} ref={wrapRef}>
      <div className={styles.recipientChips}>
        {value.map((recipientId) => (
          <span key={recipientId} className={styles.recipientChip}>
            {labels[recipientId] ?? recipientId}
            <button
              type="button"
              className={styles.recipientChipRemove}
              aria-label={t('notifications.recipientPicker.remove')}
              onClick={() => removeRecipient(recipientId)}
            >
              <X size={14} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          className={styles.recipientInput}
          type="search"
          value={query}
          placeholder={t('notifications.recipientPicker.placeholder')}
          aria-label={t('notifications.recipientPicker.search')}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </div>

      {open && debounced.length >= 2 && (
        <ul id={listId} className={styles.recipientDropdown} role="listbox">
          {loading && (
            <li className={styles.recipientOption} aria-busy="true">
              …
            </li>
          )}
          {!loading && results.length === 0 && (
            <li className={styles.recipientOption}>{t('notifications.recipientPicker.empty')}</li>
          )}
          {!loading &&
            results.map((userItem) => (
              <li key={userItem.id}>
                <button
                  type="button"
                  className={styles.recipientOption}
                  role="option"
                  onClick={() => addRecipient(userItem)}
                >
                  <span>{userItem.fullName}</span>
                  <span className={styles.recipientOptionMeta}>{userItem.email}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
