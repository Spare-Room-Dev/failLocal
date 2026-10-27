import { dayHour, timelineMarkers } from '../model/timelineEvents.js';
import { appStore, useStore } from '../model/store.js';
import './timeline.css';

/**
 * The timeline's events as a list (ruling R10): the axis labels only the focused or hovered hairline
 * and the latest event, so every event is also written out here, with its day and hour.
 */
export function EventList({ className }: { className?: string }) {
  const run = useStore(appStore, (s) => s.lastGood);
  if (!run) return null;
  return (
    <section className={`event-list${className ? ` ${className}` : ''}`} aria-label="Events">
      <h2 className="event-list-title">Events</h2>
      <ol>
        {timelineMarkers(run).map((m, i) => (
          <li key={i} data-event={m.kind}>
            <span className="event-list-when" data-clock>
              {dayHour(m.hour)}
            </span>{' '}
            <span className="event-list-what">
              {m.name} {m.word}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
