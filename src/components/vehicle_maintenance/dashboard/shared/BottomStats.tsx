type Color = 'blue' | 'red' | 'green' | 'amber' | 'purple';

interface Stat {
  value: string;
  label: string;
  color: Color;
}

interface BottomStatsProps {
  stats: Stat[];
}

const colorStyles: Record<Color, string> = {
  blue:   'text-blue-600',
  red:    'text-red-500',
  green:  'text-green-600',
  amber:  'text-amber-600',
  purple: 'text-purple-600',
};

export default function BottomStats({ stats }: BottomStatsProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
      {stats.map((s, i) => (
        <div key={i} className="text-center py-5 px-4">
          <p className={`text-2xl font-medium leading-none mb-1 ${colorStyles[s.color]}`}>
            {s.value}
          </p>
          <p className="text-xs text-gray-400">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
