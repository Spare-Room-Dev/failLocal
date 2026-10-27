import { sampleAt } from '../model/clock.js';
import { register } from '../model/register.js';
import { appStore, useStore } from '../model/store.js';
import { Qty } from './Qty.js';
import './timeline.css';

/**
 * DESIGN.md "Stock Meters" names the rows Diesel, ROM pad and Stockpile. The register's names are
 * full phrases ("Diesel in the fuel farm"), too long for the 64 px name column, so each row shows the
 * short name and keeps the register's name as its tooltip.
 */
const ROWS = [
  { id: 'diesel', label: 'Diesel' },
  { id: 'rom-pad', label: 'ROM pad' },
  { id: 'ore-stockpile', label: 'Stockpile' },
] as const;

function stock(id: string) {
  const s = register.stocks.find((x) => x.id === id);
  if (!s) throw new Error(`register has no stock ${id}`);
  return s;
}

/** Diesel, ROM pad and stockpile at the start of the current hour, in days, with fill = level ÷ capacity. */
export function StockMeters() {
  const run = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  if (!run) return null;
  const sample = sampleAt(run, hour);

  return (
    <div className="stock-meters" role="group" aria-label="Stocks">
      {ROWS.map(({ id, label }) => {
        const level = sample.stocks[id];
        if (level === undefined) throw new Error(`run has no level for stock ${id}`);
        // The run's capacity, so an overridden capacity rescales the fill.
        const capacity = run.assumptionsUsed[`stocks.${id}.capacity`]?.value ?? stock(id).capacity.value;
        const fill = capacity > 0 ? Math.min(1, Math.max(0, level / capacity)) : 0;
        return (
          <div key={id} className="stock-row">
            <span className="stock-name" title={stock(id).name}>
              {label}
            </span>
            <div
              className="stock-track"
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={capacity}
              aria-valuenow={level}
            >
              <div className="stock-fill" style={{ width: `${fill * 100}%` }} />
            </div>
            <span className="stock-value">
              <Qty value={level} kind="days" display="computed" />
            </span>
          </div>
        );
      })}
    </div>
  );
}
