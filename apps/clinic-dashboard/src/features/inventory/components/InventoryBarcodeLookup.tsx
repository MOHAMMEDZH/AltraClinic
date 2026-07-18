import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ScanLine } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { mapInventoryApiError } from '../api/inventory-api';
import type { InventoryBarcodeAction } from '../config/inventory-config';
import { isBarcodeCameraSupported } from '../utils/barcode-camera';
import { useLookupInventoryItem } from '../hooks/useInventory';
import type { InventoryItem, InventoryLookupMatch } from '../types/inventory.types';
import { InventoryBarcodeCamera } from './InventoryBarcodeCamera';
import styles from './InventoryBarcodeLookup.module.css';

interface InventoryBarcodeLookupProps {
  scanMode: boolean;
  onScanModeChange: (active: boolean) => void;
  action?: InventoryBarcodeAction;
  onActionChange?: (action: InventoryBarcodeAction) => void;
  showReceiveAction?: boolean;
  onItemFound: (item: InventoryItem, matchedBy: InventoryLookupMatch) => void;
}

export function InventoryBarcodeLookup({
  scanMode,
  onScanModeChange,
  action = 'navigate',
  onActionChange,
  showReceiveAction = false,
  onItemFound,
}: InventoryBarcodeLookupProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [lastMatch, setLastMatch] = useState<InventoryLookupMatch | null>(null);
  const [cameraMode, setCameraMode] = useState(false);
  const [scanAnnouncement, setScanAnnouncement] = useState('');
  const lookupMutation = useLookupInventoryItem();
  const receiveMode = action === 'receive';
  const cameraSupported = isBarcodeCameraSupported();

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (scanMode && !cameraMode) focusInput();
  }, [scanMode, cameraMode, focusInput]);

  const lookupCode = useCallback(
    async (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) return;
      setErrorKey(null);
      setLastMatch(null);
      try {
        const result = await lookupMutation.mutateAsync(trimmed);
        setLastMatch(result.matchedBy);
        setCode('');
        if (scanMode || cameraMode) {
          setScanAnnouncement(formatMessage(t('inventory.a11y.cameraDetected'), { code: trimmed }));
        }
        onItemFound(result.item, result.matchedBy);
        if (scanMode && !cameraMode) focusInput();
      } catch (err) {
        setErrorKey(mapInventoryApiError(err));
        if (scanMode && !cameraMode) focusInput();
      }
    },
    [lookupMutation, onItemFound, scanMode, cameraMode, focusInput, t],
  );

  async function submitLookup() {
    await lookupCode(code);
  }

  function toggleCameraMode() {
    setCameraMode((prev) => !prev);
  }

  return (
    <section
      id="inv-barcode-panel"
      className={`${styles.barcodePanel} ${scanMode ? styles.barcodePanelActive : ''} ${scanMode ? styles.scanActive : ''} ${receiveMode ? styles.receiveMode : ''} ${cameraMode ? styles.cameraActive : ''}`}
      aria-labelledby="inv-barcode-title"
    >
      <div className={styles.header}>
        <h2 id="inv-barcode-title" className={styles.title}>
          {receiveMode ? t('inventory.barcode.receiveTitle') : t('inventory.barcode.title')}
        </h2>
        <div className={styles.headerActions}>
          {showReceiveAction && onActionChange && (
            <div className={styles.intentToggle} role="group" aria-label={t('inventory.barcode.title')}>
              <button
                type="button"
                className={`${styles.intentBtn} ${!receiveMode ? styles.intentBtnActive : ''}`}
                aria-pressed={!receiveMode}
                onClick={() => onActionChange('navigate')}
              >
                {t('inventory.barcode.lookupMode')}
              </button>
              <button
                type="button"
                className={`${styles.intentBtn} ${receiveMode ? styles.intentBtnActive : ''}`}
                aria-pressed={receiveMode}
                onClick={() => onActionChange('receive')}
              >
                {t('inventory.barcode.receiveMode')}
              </button>
            </div>
          )}
          {cameraSupported && (
            <button
              type="button"
              className={`${styles.toggle} ${cameraMode ? styles.toggleActive : ''}`}
              aria-pressed={cameraMode}
              onClick={toggleCameraMode}
            >
              <Camera size={16} aria-hidden style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
              {cameraMode ? t('inventory.barcode.camera.stopCamera') : t('inventory.barcode.camera.useCamera')}
            </button>
          )}
          <button
            type="button"
            className={`${styles.toggle} ${scanMode ? styles.toggleActive : ''}`}
            aria-pressed={scanMode}
            onClick={() => onScanModeChange(!scanMode)}
          >
            <ScanLine size={16} aria-hidden style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
            {t('inventory.barcode.scanMode')}
          </button>
        </div>
      </div>

      {scanMode && !cameraMode && (
        <p className={styles.hint}>{receiveMode ? t('inventory.barcode.receiveHint') : t('inventory.barcode.hint')}</p>
      )}

      {cameraMode && (
        <InventoryBarcodeCamera
          active={cameraMode}
          paused={lookupMutation.isPending}
          onDetected={(value) => void lookupCode(value)}
        />
      )}

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void submitLookup();
        }}
      >
        <div className={styles.inputWrap}>
          <ScanLine size={18} className={styles.icon} aria-hidden />
          <input
            ref={inputRef}
            className={styles.input}
            value={code}
            placeholder={receiveMode ? t('inventory.barcode.receivePlaceholder') : t('inventory.barcode.placeholder')}
            aria-label={receiveMode ? t('inventory.barcode.receivePlaceholder') : t('inventory.barcode.placeholder')}
            autoComplete="off"
            spellCheck={false}
            inputMode="numeric"
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <AuthButton type="submit" loading={lookupMutation.isPending}>
          {receiveMode ? t('inventory.barcode.receiveSubmit') : t('inventory.barcode.submit')}
        </AuthButton>
      </form>

      {errorKey && (
        <AuthAlert variant="error">
          {t(`inventory.barcode.errors.${errorKey}` as 'inventory.barcode.errors.notFound')}
        </AuthAlert>
      )}

      {lastMatch && !errorKey && (
        <p className={styles.matchNote} role="status">
          {receiveMode
            ? t(`inventory.barcode.receiveMatched.${lastMatch}` as 'inventory.barcode.receiveMatched.barcode')
            : t(`inventory.barcode.matched.${lastMatch}` as 'inventory.barcode.matched.barcode')}
        </p>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {scanAnnouncement}
      </p>
    </section>
  );
}
