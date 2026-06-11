import type { LucideIcon } from 'lucide-react';

export interface KpiItem {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  colors: {
    bg: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
    subColor: string;
    border: string;
  };
}

interface KpiGridProps {
  items: KpiItem[];
}

export default function KpiGrid({ items }: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div
            key={i}
            className="rounded-xl p-4 border flex flex-col gap-3"
            style={{
              background: item.colors.bg,
              borderColor: item.colors.border,
            }}
          >
            {/* Top row — icon + label */}
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: item.colors.subColor }}
              >
                {item.label}
              </span>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: item.colors.iconBg }}
              >
                <Icon size={16} color={item.colors.iconColor} />
              </div>
            </div>

            {/* Value */}
            <div>
              <p
                className="text-2xl font-bold leading-none mb-1"
                style={{ color: item.colors.valueColor }}
              >
                {item.value}
              </p>
              <p className="text-xs" style={{ color: item.colors.subColor }}>
                {item.sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}