import type { JLPTLevel } from '../types';

const colors: Record<JLPTLevel, string> = {
  N5: 'bg-green-100 text-green-800 border-green-300',
  N4: 'bg-blue-100 text-blue-800 border-blue-300',
  N3: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  N2: 'bg-orange-100 text-orange-800 border-orange-300',
  N1: 'bg-red-100 text-red-800 border-red-300',
};

export function LevelBadge({ level, size = 'sm' }: { level: JLPTLevel; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={`inline-block border rounded-full font-bold ${colors[level]} ${
        size === 'lg' ? 'px-4 py-1 text-base' : 'px-2 py-0.5 text-xs'
      }`}
    >
      {level}
    </span>
  );
}
