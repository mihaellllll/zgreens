import api from '../api/client';

const TYPE_ICONS = {
  water: '💧',
  blackout_remove: '🌑',
  harvest: '✂️',
  check: '👁️',
  custom: '📌',
};

export default function TaskItem({ task, onUpdate }) {
  const toggle = async () => {
    const updated = await api.patch(`/tasks/${task.id}`, { completed: !task.completed });
    onUpdate(updated.data);
  };

  const due = new Date(task.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = due < today && !task.completed;
  const isToday = due.toDateString() === new Date().toDateString();

  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-lg border transition-colors ${task.completed ? 'opacity-60 bg-gray-50' : 'bg-white'} ${isOverdue ? 'border-red-200' : 'border-gray-200'}`}>
      <button
        onClick={toggle}
        type="button"
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400/60 ${
          task.completed ? 'bg-brand-500 border-brand-500' : 'border-gray-300 hover:border-brand-400'
        }`}
      >
        {task.completed && <span className="text-white text-xs">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {TYPE_ICONS[task.type] || '📌'} {task.title}
        </p>
        {task.batch && (
          <p className="text-xs text-gray-400 truncate">{task.batch.cropType?.name}</p>
        )}
      </div>
      <span className={`text-xs shrink-0 ${isOverdue ? 'text-red-500 font-medium' : isToday ? 'text-brand-600 font-medium' : 'text-gray-400'}`}>
        {isToday ? 'Today' : isOverdue ? 'Overdue' : due.toLocaleDateString()}
      </span>
    </div>
  );
}
