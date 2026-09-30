import { useState } from 'react';
import type { Alarm, NotificationStatus } from '../types';
import {
  STRATEGY_LABELS,
  STRATEGY_FIELDS,
  PRICE_FIELD_NAMES,
} from '../strategies';
import { MARKET_LABELS, CURRENCY_SYMBOLS } from '../markets';
import {
  TrashIcon,
  EmptyAlarmsIcon,
  ClockIcon,
  CheckCircleIcon,
  LayersIcon,
} from './icons';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  alarms: Alarm[];
  onSetStatus: (id: string, status: 'ACTIVE' | 'DISABLED') => void;
  onEdit: (alarm: Alarm) => void;
  onDelete: (id: string) => void;
  // Portfolio id -> name, for tagging alarms that came from an import.
  portfolioNames: Map<string, string>;
}

interface ParamStat {
  label: string;
  value: string;
}

function paramStats(alarm: Alarm): ParamStat[] {
  const currency = CURRENCY_SYMBOLS[alarm.market];
  const fields = STRATEGY_FIELDS[alarm.strategyType];
  return Object.entries(alarm.params).map(([key, value]) => {
    const label = fields.find((f) => f.name === key)?.label ?? key;
    return {
      label,
      value: PRICE_FIELD_NAMES.has(key) ? `${currency}${value}` : String(value),
    };
  });
}

function formatTriggeredAt(triggeredAt: string): string {
  return new Date(triggeredAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const NOTIFICATION_LABELS: Record<NotificationStatus, string> = {
  NOT_NOTIFIED: 'Not yet notified',
  NOTIFIED_ONCE: 'Notified once',
  NOTIFIED_TWICE: 'Notified twice',
};

function NotificationStatusTag({ status }: { status: NotificationStatus }) {
  return (
    <span
      className={`notification-status ${status !== 'NOT_NOTIFIED' ? 'is-notified' : ''}`}
    >
      {status === 'NOT_NOTIFIED' ? <ClockIcon /> : <CheckCircleIcon />}
      {NOTIFICATION_LABELS[status]}
    </span>
  );
}

function StatusBadge({ status }: { status: Alarm['status'] }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      <span className="badge-dot" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function AlarmList({
  alarms,
  onSetStatus,
  onEdit,
  onDelete,
  portfolioNames,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<Alarm | null>(null);

  if (alarms.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <EmptyAlarmsIcon />
        </span>
        <h3>No alarms yet</h3>
        <p>Create your first alarm to get started.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="alarm-list">
        {alarms.map((alarm) => (
          <li
            key={alarm.id}
            className={`card alarm-row ${alarm.status === 'TRIGGERED' ? 'is-triggered' : ''} ${
              alarm.status === 'DISABLED' ? 'is-disabled' : ''
            }`}
          >
            <div className="alarm-identity">
              <div className="alarm-identity-main">
                <strong className="ticker">{alarm.ticker}</strong>
                <span className="tag">{MARKET_LABELS[alarm.market]}</span>
                {alarm.portfolioId && portfolioNames.has(alarm.portfolioId) && (
                  <span
                    className="tag portfolio-tag"
                    title={`From portfolio "${portfolioNames.get(alarm.portfolioId)}"`}
                  >
                    <LayersIcon size={11} />
                    <span>{portfolioNames.get(alarm.portfolioId)}</span>
                  </span>
                )}
              </div>
              <span className="alarm-strategy-label">
                {STRATEGY_LABELS[alarm.strategyType]}
              </span>
            </div>
            <div className="alarm-status-col">
              <StatusBadge status={alarm.status} />
              {alarm.status === 'TRIGGERED' && alarm.triggeredAt && (
                <span className="alarm-triggered-at">
                  Triggered on {formatTriggeredAt(alarm.triggeredAt)}
                </span>
              )}
            </div>
            <div className="alarm-param-grid">
              {paramStats(alarm).map((stat) => (
                <div key={stat.label} className="alarm-param-stat">
                  <div className="alarm-param-label">{stat.label}</div>
                  <div className="alarm-param-value mono">{stat.value}</div>
                </div>
              ))}
            </div>
            <div className="alarm-footer">
              <NotificationStatusTag status={alarm.notificationStatus} />
              <div className="alarm-actions">
                {alarm.status !== 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => onSetStatus(alarm.id, 'ACTIVE')}
                  >
                    {alarm.status === 'TRIGGERED' ? 'Re-arm' : 'Enable'}
                  </button>
                )}
                {alarm.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => onSetStatus(alarm.id, 'DISABLED')}
                  >
                    Disable
                  </button>
                )}
                <button type="button" onClick={() => onEdit(alarm)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => setPendingDelete(alarm)}
                >
                  <TrashIcon size={13} />
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {pendingDelete && (
        <ConfirmDialog
          title="Delete alarm"
          message={`Delete the ${STRATEGY_LABELS[pendingDelete.strategyType]} alarm for ${pendingDelete.ticker}? This can't be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
}
