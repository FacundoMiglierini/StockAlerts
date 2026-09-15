import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Alarm, Market, StrategyType } from '../types';
import { AlarmForm } from '../components/AlarmForm';
import { BackIcon } from '../components/icons';
import { useToast } from '../components/Toast';

export function CreateAlarmPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  async function handleCreate(
    ticker: string,
    strategyType: StrategyType,
    market: Market,
    params: Record<string, number>,
  ) {
    try {
      const created = await api.post<Alarm>('/alarms', {
        ticker,
        strategyType,
        market,
        params,
      });
      showSuccess(`Alarm created for ${created.ticker}.`);
      navigate('/alarms');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create alarm');
      throw err;
    }
  }

  return (
    <div className="mobile-create-page">
      <header className="mobile-create-header">
        <button
          type="button"
          className="icon-button"
          onClick={() => navigate('/alarms')}
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <span className="mobile-create-title">New alarm</span>
      </header>
      <div className="mobile-create-body">
        <AlarmForm onCreate={handleCreate} />
      </div>
    </div>
  );
}
