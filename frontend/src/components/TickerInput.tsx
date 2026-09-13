import { useState } from 'react'
import type { Market } from '../types'
import { searchTickers } from '../tickers'

interface Props {
  value: string
  market: Market
  onChange: (value: string) => void
}

export function TickerInput({ value, market, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  const matches = searchTickers(market, value)

  function selectTicker(symbol: string) {
    onChange(symbol)
    setOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((prev) => (prev + 1) % matches.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((prev) => (prev - 1 + matches.length) % matches.length)
    } else if (event.key === 'Enter' && highlighted >= 0) {
      event.preventDefault()
      selectTicker(matches[highlighted].symbol)
    } else if (event.key === 'Escape') {
      // Stop propagation so this only closes the suggestions dropdown, not
      // a wrapping Modal that also listens for Escape (e.g. the "New
      // alarm" modal) — otherwise dismissing the dropdown closes the form.
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className="ticker-input">
      <input
        className="ticker"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase())
          setOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder="AAPL"
        autoComplete="off"
        required
      />
      {open && matches.length > 0 && (
        <ul className="ticker-dropdown" role="listbox">
          {matches.map((option, index) => (
            <li key={option.symbol}>
              <button
                type="button"
                className={index === highlighted ? 'is-highlighted' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectTicker(option.symbol)}
              >
                <span className="ticker-dropdown-symbol">{option.symbol}</span>
                <span className="ticker-dropdown-name">{option.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
