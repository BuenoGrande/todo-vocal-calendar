import { useState } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TodoItem } from '../types'

interface TodoListProps {
  todos: TodoItem[]
  onAddTodo: (title: string, duration: number) => void
  onUpdateTodo: (id: string, updates: Partial<TodoItem>) => void
  onDeleteTodo: (id: string) => void
}

function DurationStepper({
  value,
  onChange,
  small,
}: {
  value: number
  onChange: (v: number) => void
  small?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(5, value - 5))}
        className={`flex items-center justify-center rounded-md bg-[#1a1a1a] hover:bg-[#222] text-[#666] hover:text-[#888] transition-colors cursor-pointer ${small ? 'w-6 h-6' : 'w-7 h-7'}`}
      >
        <svg className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <span className={`font-medium text-[#888] text-center tabular-nums ${small ? 'text-xs w-10' : 'text-sm w-12'}`}>
        {value}m
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 5)}
        className={`flex items-center justify-center rounded-md bg-[#1a1a1a] hover:bg-[#222] text-[#666] hover:text-[#888] transition-colors cursor-pointer ${small ? 'w-6 h-6' : 'w-7 h-7'}`}
      >
        <svg className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
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
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(todo.title)
  const [editDuration, setEditDuration] = useState(todo.duration)

  const isPriority = index < 3
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function saveEdit() {
    const rounded = Math.max(5, Math.round(editDuration / 5) * 5)
    onUpdate({
      title: editTitle.trim() || todo.title,
      duration: rounded,
    })
    setIsEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
        isPriority
          ? 'bg-[#0a0a0a] border-[#FF3300]/20 hover:border-[#FF3300]/40 hover:translate-x-1'
          : 'bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#333] hover:translate-x-1'
      } ${isDragging ? 'shadow-lg shadow-[#FF3300]/10 z-10' : ''}`}
    >
      {/* Priority badge or bullet */}
      {isPriority ? (
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FF3300] text-white text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>
      ) : (
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[#444]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#444]" />
        </span>
      )}

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[#333] hover:text-[#555] touch-none"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>

      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
            className="flex-1 px-2 py-1 text-sm rounded bg-[#111] border border-[#333] text-white focus:outline-none focus:border-[#FF3300]/50"
            autoFocus
          />
          <DurationStepper value={editDuration} onChange={setEditDuration} small />
          <button
            onClick={saveEdit}
            className="text-[#FF3300] hover:text-[#FF4400] cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => {
              setEditTitle(todo.title)
              setEditDuration(todo.duration)
              setIsEditing(true)
            }}
          >
            <p className={`text-sm truncate ${isPriority ? 'text-white font-medium' : 'text-[#ccc]'}`}>
              {todo.title}
            </p>
          </div>
          <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
            isPriority
              ? 'bg-[#FF3300]/10 text-[#FF3300]'
              : 'bg-[#1a1a1a] text-[#666]'
          }`}>
            {todo.duration}m
          </span>
          <button
            onClick={onDelete}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-[#333] hover:text-[#FF3300] transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

export default function TodoList({ todos, onAddTodo, onUpdateTodo, onDeleteTodo }: TodoListProps) {
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

  const priorities = todos.slice(0, 3)
  const backlog = todos.slice(3)

  return (
    <div className="flex flex-col h-full">
      {/* Add task card */}
      <div className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] p-3 mb-4">
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a task..."
          className="w-full px-1 py-1.5 text-sm bg-transparent text-white focus:outline-none placeholder-[#444]"
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1a1a1a]">
          <DurationStepper value={newDuration} onChange={setNewDuration} />
          <button
            onClick={handleAdd}
            disabled={!newTask.trim()}
            className="px-4 py-1.5 rounded-full bg-[#FF3300] text-white text-sm font-medium hover:bg-[#FF4400] hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {todos.length === 0 ? (
          <div className="text-center py-12 text-[#444]">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs mt-1 text-[#333]">Type a task above or use the microphone</p>
          </div>
        ) : (
          <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {/* Priorities section */}
            {priorities.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[10px] uppercase tracking-widest text-[#FF3300] font-bold mb-2 px-1">
                  Priorities
                </h3>
                <div className="space-y-2">
                  {priorities.map((todo, i) => (
                    <SortableTodoItem
                      key={todo.id}
                      todo={todo}
                      index={i}
                      onUpdate={(updates) => onUpdateTodo(todo.id, updates)}
                      onDelete={() => onDeleteTodo(todo.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Backlog section */}
            {backlog.length > 0 && (
              <div>
                <h3 className="text-[10px] uppercase tracking-widest text-[#555] font-bold mb-2 px-1">
                  Backlog
                </h3>
                <div className="space-y-2">
                  {backlog.map((todo, i) => (
                    <SortableTodoItem
                      key={todo.id}
                      todo={todo}
                      index={i + 3}
                      onUpdate={(updates) => onUpdateTodo(todo.id, updates)}
                      onDelete={() => onDeleteTodo(todo.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
