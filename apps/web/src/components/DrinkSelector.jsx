import { CATEGORIES } from "../constants/drinks";

export default function DrinkSelector({ selected, onSelect }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {CATEGORIES.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`flex flex-col items-center justify-center rounded-2xl px-4 py-3 transition-all ${
            selected === cat.id ? 'bg-brand/10 text-brand' : 'bg-neutral-50'
          }`}
        >
          <span className="text-2xl">{cat.icon}</span>
          <span className="text-xs mt-1">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
