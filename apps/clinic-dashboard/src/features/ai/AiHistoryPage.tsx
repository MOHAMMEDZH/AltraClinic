import { useI18n } from '@booking/i18n/react';
import { AiConversationList } from './components/chat/AiConversationList';
import { AiSection } from './components/enterprise/AiSection';

export function AiHistoryPage() {
  const { t } = useI18n();
  return (
    <AiSection title={t('ai.nav.history')} hint={t('ai.chat.historyHint')}>
      <AiConversationList />
    </AiSection>
  );
}
