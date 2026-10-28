import './chrome.css';

/** A pit in section: four bench lines narrowing upward, cut at the top right by a short red stroke. */
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 28 24" aria-hidden="true">
      <path d="M2 21 H26 M5 16 H23 M8 11 H20 M11 6 H17" stroke="var(--ink)" strokeWidth={2} fill="none" />
      <path d="M19 2 L25 9" stroke="var(--stop-red)" strokeWidth={2.2} />
    </svg>
  );
}

/** The FailLocal lockup: the brand mark and the word, as in the top bar and on the welcome page. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={className ? `brand ${className}` : 'brand'}>
      <BrandMark />
      <span className="brand-word">FailLocal</span>
    </div>
  );
}
