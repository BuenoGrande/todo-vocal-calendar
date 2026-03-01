import { useState } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Sparkles, ChevronDown, ChevronRight, Trash2, Mic } from 'lucide-react'
import type { TodoItem } from '../types'
import TaskCard from './TaskCard'

interface TodoListProps {
  todos: TodoItem[]
  listName: string
  collapsed: boolean
  onToggleCollapse: () => void
  onRename: (newName: string) => void
  onDelete: () => void
  onOpenVoice: () => void
  canDelete: boolean
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

export default function TodoList({
  todos,
  listName,
  collapsed,
  onToggleCollapse,
  onRename,
  onDelete,
  onOpenVoice,
  canDelete,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
  onAutoSchedule,
  isScheduling,
}: TodoListProps) {
  const [newTask, setNewTask] = useState('')
  const [newDuration, setNewDuration] = useState(30)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(listName)

  function handleAdd() {
    const title = newTask.trim()
    if (!title) return
    const dur = Math.max(5, Math.round(newDuration / 5) * 5)
    onAddTodo(title, dur)
    setNewTask('')
    setNewDuration(30)
  }

  function handleRenameSubmit() {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== listName) {
      onRename(trimmed)
    } else {
      setEditName(listName)
    }
    setIsEditing(false)
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-deep/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={onToggleCollapse}
              className="text-secondary hover:text-primary transition-colors cursor-pointer shrink-0"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isEditing ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit()
                  if (e.key === 'Escape') { setEditName(listName); setIsEditing(false) }
                }}
                autoFocus
                className="text-lg font-semibold text-primary bg-transparent border-b border-accent focus:outline-none min-w-0"
              />
            ) : (
              <h2
                className="text-lg font-semibold text-primary truncate cursor-pointer"
                onDoubleClick={() => { setEditName(listName); setIsEditing(true) }}
                title="Double-click to rename"
              >
                {listName}
              </h2>
            )}

            <span className="text-xs font-medium text-secondary bg-elevated px-2 py-0.5 rounded-full border border-border shrink-0">
              {todos.length}
            </span>
          </div>

          {canDelete && (
            <button
              onClick={onDelete}
              className="text-dim hover:text-critical transition-colors cursor-pointer shrink-0 ml-2"
              title="Delete list"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible content */}
      {!collapsed && (
        <>
          {/* Add task row */}
          <div className="p-4 border-b border-border">
            <div className="flex gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Type a task..."
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
              <button
                onClick={onOpenVoice}
                className="w-9 h-9 rounded-lg bg-elevated border border-border hover:border-accent hover:text-accent flex items-center justify-center transition-colors text-secondary cursor-pointer shrink-0"
                title="Add tasks by voice"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            {/* Auto-schedule button */}
            {onAutoSchedule && todos.length > 0 && (
              <button
                onClick={onAutoSchedule}
                disabled={isScheduling}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-accent bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 0 12px -2px rgba(139,92,246,0.3)' }}
              >
                {isScheduling ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Auto-schedule
              </button>
            )}
          </div>

          {/* Task list */}
          <div className="p-4">
            {todos.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-dim border border-dashed border-border rounded-lg bg-elevated/30">
                <p className="font-medium text-sm mb-1">No tasks yet</p>
                <p className="text-xs">Type or speak to add tasks.</p>
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
        </>
      )}
    </div>
  )
}
