import { useEffect, useState, useRef, useCallback } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Info } from 'lucide-react';

type InsightType = 'info' | 'trend' | 'warning';

interface Highlight {
  text: string;
  color: string;
}

interface Insight {
  type: InsightType;
  title: string;
  text: string;
  highlight?: Highlight;
}

interface NarrativeCardProps {
  insights: Insight[];
  title?: string;
  subtitle?: string;
  /** ms per character. Default: 28 */
  speed?: number;
  /** Unique key — change this to re-trigger animation (e.g. pass activeTab) */
  animationKey?: string | number;
}

const typeConfig: Record<InsightType, {
  Icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}> = {
  info:    { Icon: Info,          iconBg: '#ede9fe', iconColor: '#6d28d9' },
  trend:   { Icon: TrendingUp,    iconBg: '#fce7f3', iconColor: '#be185d' },
  warning: { Icon: AlertTriangle, iconBg: '#fef9c3', iconColor: '#a16207' },
};

function HighlightedText({ text, highlight }: { text: string; highlight?: Highlight }) {
  if (!highlight) return <span>{text}</span>;
  const idx = text.indexOf(highlight.text);
  if (idx === -1) return <span>{text}</span>;
  return (
    <>
      <span>{text.slice(0, idx)}</span>
      <span style={{ color: highlight.color, fontWeight: 600 }}>
        {text.slice(idx, idx + highlight.text.length)}
      </span>
      <span>{text.slice(idx + highlight.text.length)}</span>
    </>
  );
}

/**
 * Single row — only starts when `canStart` is true.
 * Calls `onDone` exactly once when typing completes.
 * Never restarts.
 */
function InsightRow({
  insight,
  canStart,
  speed,
  onDone,
}: {
  insight: Insight;
  canStart: boolean;
  speed: number;
  onDone: () => void;
}) {
  const fullText                            = insight.text;
  const [chars, setChars]                   = useState(0);
  const [done, setDone]                     = useState(false);
  const [visible, setVisible]               = useState(false);
  const hasStarted                          = useRef(false);
  const onDoneRef                           = useRef(onDone);
  onDoneRef.current                         = onDone;

  useEffect(() => {
    if (!canStart || hasStarted.current) return;
    hasStarted.current = true;

    // Fade in the row first
    setVisible(true);

    // Small pause before typing starts
    const startDelay = setTimeout(() => {
      const interval = setInterval(() => {
        setChars(prev => {
          const next = prev + 1;
          if (next >= fullText.length) {
            clearInterval(interval);
            // Mark done after a tiny delay so last char renders first
            setTimeout(() => {
              setDone(true);
              onDoneRef.current();
            }, 80);
          }
          return next;
        });
      }, speed);
      return () => clearInterval(interval);
    }, 200);

    return () => clearTimeout(startDelay);
  }, [canStart, fullText, speed]);

  const cfg  = typeConfig[insight.type];
  const Icon = cfg.Icon;

  return (
    <div
      className="flex items-start gap-3 py-3.5 first:pt-2 last:pb-2"
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: cfg.iconBg }}
      >
        <Icon size={13} color={cfg.iconColor} />
      </div>

      <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
        <strong className="font-semibold text-gray-900">{insight.title}: </strong>
        {done ? (
          <HighlightedText text={fullText} highlight={insight.highlight} />
        ) : (
          <>
            <span>{fullText.slice(0, chars)}</span>
            {visible && (
              <span
                style={{
                  display:       'inline-block',
                  width:         '2px',
                  height:        '13px',
                  background:    '#7c3aed',
                  marginLeft:    '1px',
                  verticalAlign: 'text-bottom',
                  borderRadius:  '1px',
                  animation:     'nblink 0.75s step-end infinite',
                }}
              />
            )}
          </>
        )}
      </p>
    </div>
  );
}

export default function NarrativeCard({
  insights,
  title       = 'AI story telling dashboard',
  subtitle    = 'Consolidated narrative insights from your fleet data',
  speed       = 28,
  animationKey,
}: NarrativeCardProps) {
  // currentIndex = which row is currently allowed to type
  // starts at 0, increments when each row calls onDone
  const [currentIndex, setCurrentIndex] = useState(0);

  // Internal reset key — changes when animationKey changes
  const [resetKey, setResetKey] = useState(0);
  const prevAnimKey = useRef(animationKey);

  useEffect(() => {
    if (animationKey !== undefined && animationKey !== prevAnimKey.current) {
      prevAnimKey.current = animationKey;
      setCurrentIndex(0);
      setResetKey(k => k + 1);
    }
  }, [animationKey]);

  const handleDone = useCallback((i: number) => {
    setCurrentIndex(prev => Math.max(prev, i + 1));
  }, []);

  return (
    <>
      <style>{`
        @keyframes nblink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: '#f8f7ff', borderColor: '#e5e2ff' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: '#ede9fe' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3"  y="3"  width="8" height="8" rx="2" fill="white" fillOpacity="0.9"/>
              <rect x="13" y="3"  width="8" height="8" rx="2" fill="white" fillOpacity="0.6"/>
              <rect x="3"  y="13" width="8" height="8" rx="2" fill="white" fillOpacity="0.6"/>
              <rect x="13" y="13" width="8" height="8" rx="2" fill="white" fillOpacity="0.9"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{title}</span>
              <Sparkles size={13} color="#7c3aed" />
            </div>
            <p className="text-xs" style={{ color: '#7c6fa0' }}>{subtitle}</p>
          </div>
        </div>

        {/* Rows */}
        <div className="px-5 py-3 divide-y" style={{ borderColor: '#ede9fe' }}>
          {insights.map((ins, i) => (
            <InsightRow
              key={`${resetKey}-${i}`}
              insight={ins}
              canStart={i <= currentIndex}
              speed={speed}
              onDone={() => handleDone(i)}
            />
          ))}
        </div>
      </div>
    </>
  );
}