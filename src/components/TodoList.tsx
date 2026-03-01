import { useState } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Sparkles } from 'lucide-react'
import type { TodoItem } from '../types'
import TaskCard from './TaskCard'

interface TodoListProps {
  todos: TodoItem[]
  onAddTodo: (title: string, duration: number) => void
  onUpdateTodo: (id: string, updates: Partial<TodoItem>) => void
  onDeleteTodo: (id: string) => void
  onAutoSchedule?: () => void
  isScheduling?: boolean
}

function SortableTodoItem({
  todo,
  index,
  onUpdate,
  onDelete,
}: {
  todo: TodoItem
  index: number
  onUpdate: (updates: Partial<TodoItem>) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        todo={todo}
        rank={index + 1}
        showCheckbox
        isDragging={isDragging}
        onComplete={onDelete}
        onDurationChange={(dur) => onUpdate({ duration: dur })}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

export default function TodoList({ todos, onAddTodo, onUpdateTodo, onDeleteTodo, onAutoSchedule, isScheduling }: TodoListProps) {
  const [newTask, setNewTask] = useState('')
  const [newDuration, setNewDuration] = useState(30)

  function handleAdd() {
    const title = newTask.trim()
    if (!title) return
    const dur = Math.max(5, Math.round(newDuration / 5) * 5)
    onAddTodo(title, dur)
    setNewTask('')
    setNewDuration(30)
  }

  return (
    <div className="h-full w-full bg-surface border-r border-border flex flex-col">
      <div className="p-6 border-b border-border bg-deep/50">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-primary flex items-center gap-3">
            Backlog
            <span className="text-xs font-medium text-secondary bg-elevated px-2 py-0.5 rounded-full border border-border">
              {todos.length}
            </span>
          </h2>

          {onAutoSchedule && todos.length > 0 && (
            <button
              onClick={onAutoSchedule}
              disabled={isScheduling}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isScheduling ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Auto-schedule
            </button>
          )}
        </div>
        <p className="text-secondary text-sm">Prioritize tasks and schedule them to your day.</p>

        {/* Inline add task */}
        <div className="mt-4 flex gap-2">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add a task..."
            className="flex-1 px-3 py-2 text-sm bg-elevated border border-border rounded-lg text-primary focus:outline-none focus:border-accent/50 placeholder-dim"
          />
          <select
            value={newDuration}
            onChange={(e) => setNewDuration(Number(e.target.value))}
            className="px-2 py-2 text-xs bg-elevated border border-border rounded-lg text-secondary focus:outline-none focus:border-accent/50 cursor-pointer"
          >
            <option value={5}>5m</option>
            <option value={15}>15m</option>
            <option value={30}>30m</option>
            <option value={45}>45m</option>
            <option value={60}>1h</option>
            <option value={90}>1.5h</option>
            <option value={120}>2h</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!newTask.trim()}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-glow disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {todos.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-dim border border-dashed border-border rounded-lg bg-elevated/30">
            <p className="font-medium text-sm mb-1">Backlog is empty</p>
            <p className="text-xs">Create a new task to get started.</p>
          </div>
        ) : (
          <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {todos.map((todo, i) => (
                <SortableTodoItem
                  key={todo.id}
                  todo={todo}
                  index={i}
                  onUpdate={(updates) => onUpdateTodo(todo.id, updates)}
                  onDelete={() => onDeleteTodo(todo.id)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  )
}
