// Profil-Sheet: Konto-Info, Darstellung (System/Hell/Dunkel), Abmelden.
// Wrapper bewusst identisch zum bisherigen Markup.
import { supabase } from '../lib/supabase.js'
import { applyTheme } from '../lib/theme.js'
import Icon from './Icon.jsx'

export default function ProfileSheet({ session, readOnly, theme, setTheme, onClose }) {
  return (
    <div className="fixed inset-0 z-30" onClick={onClose} style={{ background: 'rgb(0 0 0 / 0.25)' }}>
      <div
        className="absolute bottom-0 inset-x-0 bg-card rounded-t-[22px] animate-sheet px-5 pt-3"
        style={{ boxShadow: 'var(--shadow-sheet)', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto rounded-full" style={{ width: 38, height: 4, background: 'var(--color-handle)' }} />
        <div className="flex items-center gap-3 mt-5 mb-6">
          <span className="grid place-content-center w-11 h-11 rounded-full bg-tint-soft text-tint">
            <Icon name="user" size={20} strokeWidth={2} />
          </span>
          <div>
            <p className="text-[15.5px] font-semibold text-ink">Angemeldet</p>
            <p className="text-[13.5px] text-ink-3">{session.user.email}</p>
          </div>
        </div>

        {readOnly && (
          <div className="mb-5 rounded-[12px] bg-fill px-4 py-3 text-[13.5px] text-ink-2">
            Dieses Konto besitzt <strong>nur Leserechte</strong> – du kannst alles ansehen,
            aber nichts speichern oder ändern.
          </div>
        )}

        {/* Darstellung: System / Hell / Dunkel */}
        <p className="text-[12px] font-semibold uppercase text-ink-3 mb-2" style={{ letterSpacing: '0.03em' }}>
          Darstellung
        </p>
        <div className="flex bg-fill rounded-[10px] p-0.5 mb-6">
          {[
            { key: 'system', label: 'System' },
            { key: 'light', label: 'Hell' },
            { key: 'dark', label: 'Dunkel' },
          ].map((o) => (
            <button
              key={o.key}
              onClick={() => { applyTheme(o.key); setTheme(o.key) }}
              className={`flex-1 rounded-[8px] py-1.5 text-[13.5px] font-semibold transition ${
                theme === o.key ? 'bg-card text-ink' : 'text-ink-2'
              }`}
              style={theme === o.key ? { boxShadow: '0 1px 3px rgb(0 0 0 / 0.08)' } : {}}
            >
              {o.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full h-[50px] rounded-[14px] bg-fill text-[16px] font-semibold text-love active:opacity-80 transition"
        >
          Abmelden
        </button>
      </div>
    </div>
  )
}
