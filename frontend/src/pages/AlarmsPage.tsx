import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Alarm, AlarmStatus, Market, StrategyType } from '../types'
import { AlarmForm } from '../components/AlarmForm'
import { AlarmList } from '../components/AlarmList'
import { Modal } from '../components/Modal'
import { PlusIcon } from '../components/icons'
import { useToast } from '../components/Toast'
import { FiltersBar, DEFAULT_FILTERS, applyAlarmFilters } from '../components/FiltersBar'
import type { AlarmFilters } from '../components/FiltersBar'

export function AlarmsPage() {
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [filters, setFilters] = useState<AlarmFilters>(DEFAULT_FILTERS)
  const { showSuccess, showError } = useToast()

  const filteredAlarms = useMemo(() => applyAlarmFilters(alarms, filters), [alarms, filters])

  async function loadAlarms() {
    setError(null)
    try {
      const data = await api.get<Alarm[]>('/alarms')
      setAlarms(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alarms')
    }
  }

  useEffect(() => {
    loadAlarms().finally(() => setLoading(false))
  }, [])

  async function handleCreate(
    ticker: string,
    strategyType: StrategyType,
    market: Market,
    params: Record<string, number>,
  ) {
    try {
      const created = await api.post<Alarm>('/alarms', { ticker, strategyType, market, params })
      setAlarms((prev) => [created, ...prev])
      setModalOpen(false)
      showSuccess(`Alarm created for ${created.ticker}.`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create alarm')
      throw err
    }
  }

  async function handleSetStatus(id: string, status: AlarmStatus) {
    try {
      const updated = await api.patch<Alarm>(`/alarms/${id}`, { status })
      setAlarms((prev) => prev.map((a) => (a.id === id ? updated : a)))
      showSuccess(`${updated.ticker} alarm updated.`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update alarm')
    }
  }

  async function handleDelete(id: string) {
    const alarm = alarms.find((a) => a.id === id)
    try {
      await api.delete(`/alarms/${id}`)
      setAlarms((prev) => prev.filter((a) => a.id !== id))
      showSuccess(`${alarm?.ticker ?? 'Alarm'} deleted.`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete alarm')
    }
  }

  return (
    <div className="page-stack">
      <section>
        <div className="section-header">
          <h2>Your alarms</h2>
          <div className="section-header-actions">
            <span className="tag">
              {filteredAlarms.length === alarms.length
                ? `${alarms.length} ${alarms.length === 1 ? 'alarm' : 'alarms'}`
                : `${filteredAlarms.length} of ${alarms.length} alarms`}
            </span>
            <button type="button" className="new-alarm-trigger" onClick={() => setModalOpen(true)}>
              <PlusIcon />
              New alarm
            </button>
          </div>
        </div>
        <Link to="/alarms/new" className="mobile-new-alarm-link">
          <PlusIcon />
          New alarm
        </Link>
        {!loading && !error && alarms.length > 0 && <FiltersBar filters={filters} onChange={setFilters} />}
        {loading && <p className="text-muted">Loading…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && alarms.length > 0 && filteredAlarms.length === 0 && (
          <div className="empty-state">
            <h3>No alarms match your filters</h3>
            <p>Try widening or clearing the filters above.</p>
          </div>
        )}
        {!loading && !error && (alarms.length === 0 || filteredAlarms.length > 0) && (
          <AlarmList alarms={filteredAlarms} onSetStatus={handleSetStatus} onDelete={handleDelete} />
        )}
      </section>
      {modalOpen && (
        <Modal title="New alarm" onClose={() => setModalOpen(false)}>
          <AlarmForm onCreate={handleCreate} />
        </Modal>
      )}
    </div>
  )
}
