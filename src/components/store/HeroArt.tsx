/**
 * Default hero still-life (vector, ~3 KB): an arched niche — a nod to the
 * stone arches of old Ramallah — framing two perfume bottles in the brand's
 * burgundy and champagne gold. Shown until the owners upload a hero photo.
 */
export function HeroArt({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 560 640" role="img" aria-label={title} className="h-auto w-full">
      <defs>
        <linearGradient id="h-arch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4EEE4" />
          <stop offset="1" stopColor="#E9DFCF" />
        </linearGradient>
        <linearGradient id="h-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9B2A2F" />
          <stop offset="1" stopColor="#5A1418" />
        </linearGradient>
        <linearGradient id="h-amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3C88F" />
          <stop offset="1" stopColor="#B07F35" />
        </linearGradient>
        <linearGradient id="h-glass" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".15" />
          <stop offset="1" stopColor="#fff" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id="h-gold" x1="0" x2="1">
          <stop offset="0" stopColor="#8A6A35" />
          <stop offset=".5" stopColor="#EAD3A0" />
          <stop offset="1" stopColor="#8A6A35" />
        </linearGradient>
        <radialGradient id="h-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M60 640V250C60 120 160 30 280 30s220 90 220 220v390Z" fill="url(#h-arch)" />
      <path d="M60 640V250C60 120 160 30 280 30s220 90 220 220v390" fill="none" stroke="#C4A46B" strokeWidth="1.5" />
      <path d="M84 640V254C84 140 172 56 280 56s196 84 196 198v386" fill="none" stroke="#C4A46B" strokeOpacity=".45" strokeWidth="1" />
      <ellipse cx="280" cy="230" rx="170" ry="150" fill="url(#h-glow)" />
      {/* tall bottle */}
      <ellipse cx="240" cy="560" rx="120" ry="16" fill="#1E1A17" opacity=".12" />
      <rect x="160" y="270" width="160" height="290" rx="22" fill="url(#h-glass)" stroke="#fff" strokeOpacity=".9" />
      <rect x="174" y="318" width="132" height="228" rx="14" fill="url(#h-liquid)" />
      <rect x="182" y="326" width="16" height="200" rx="8" fill="#fff" opacity=".18" />
      <rect x="214" y="232" width="52" height="40" rx="4" fill="url(#h-gold)" />
      <path d="M200 160h80l-6 74h-68Z" fill="#1E1A17" />
      <path d="M206 168h6l-4 60h-4Z" fill="#fff" opacity=".18" />
      <rect x="196" y="400" width="88" height="54" rx="3" fill="#FBF8F3" opacity=".92" />
      <text x="240" y="434" textAnchor="middle" fontFamily="var(--font-ruqaa), serif" fontSize="26" fill="#7A1E22">بسمان</text>
      {/* round bottle */}
      <ellipse cx="380" cy="566" rx="78" ry="12" fill="#1E1A17" opacity=".12" />
      <circle cx="380" cy="490" r="72" fill="url(#h-glass)" stroke="#fff" strokeOpacity=".9" />
      <circle cx="380" cy="498" r="58" fill="url(#h-amber)" />
      <path d="M346 470a40 40 0 0 1 22-22" stroke="#fff" strokeOpacity=".5" strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="364" y="398" width="32" height="24" rx="3" fill="url(#h-gold)" />
      <circle cx="380" cy="380" r="22" fill="url(#h-gold)" />
      {/* ornament */}
      <g fill="#C4A46B" opacity=".9">
        <path d="M280 96l6 10-6 10-6-10z" />
        <circle cx="258" cy="106" r="2" />
        <circle cx="302" cy="106" r="2" />
      </g>
    </svg>
  );
}
