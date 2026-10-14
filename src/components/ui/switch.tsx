export const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className={`relative w-8 h-[18px] shrink-0 rounded-[3px] transition ${on ? 'bg-g-text' : 'bg-g-line'}`}
  >
    <span
      className={`absolute top-0.5 w-3.5 h-3.5 rounded-[2px] bg-white shadow-sm transition-all ${on ? 'left-[16px]' : 'left-0.5'}`}
    />
  </button>
)
