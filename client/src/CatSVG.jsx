export default function CatSVG({ skin, size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="150" rx="55" ry="40" fill={skin.bodyDark} />
      <path d="M150 160 Q195 150 185 105" stroke={skin.bodyDark} strokeWidth="14" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="90" r="48" fill={skin.bodyMain} />
      <path d="M60 60 L48 20 L85 48 Z" fill={skin.bodyMain} />
      <path d="M140 60 L152 20 L115 48 Z" fill={skin.bodyMain} />
      <path d="M64 55 L56 32 L80 50 Z" fill={skin.accent} />
      <path d="M136 55 L144 32 L120 50 Z" fill={skin.accent} />
      <ellipse cx="82" cy="92" rx="7" ry="9" fill={skin.eye} />
      <ellipse cx="118" cy="92" rx="7" ry="9" fill={skin.eye} />
      <circle cx="82" cy="92" r="3" fill="#1a1428" />
      <circle cx="118" cy="92" r="3" fill="#1a1428" />
      <path d="M94 106 Q100 112 106 106" stroke={skin.eye} strokeWidth="3" fill="none" strokeLinecap="round" />
      <line x1="55" y1="100" x2="25" y2="96" stroke={skin.accent} strokeWidth="2" />
      <line x1="55" y1="108" x2="25" y2="110" stroke={skin.accent} strokeWidth="2" />
      <line x1="145" y1="100" x2="175" y2="96" stroke={skin.accent} strokeWidth="2" />
      <line x1="145" y1="108" x2="175" y2="110" stroke={skin.accent} strokeWidth="2" />
    </svg>
  );
}
