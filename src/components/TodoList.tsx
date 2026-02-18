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
        className={`flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer ${small ? 'w-6 h-6' : 'w-7 h-7'}`}
      >
        <svg className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <span className={`font-medium text-gray-700 text-center tabular-nums ${small ? 'text-xs w-10' : 'text-sm w-12'}`}>
        {value}m
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 5)}
        className={`flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer ${small ? 'w-6 h-6' : 'w-7 h-7'}`}
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
  onUpdate,
  onDelete,
}: {
  todo: TodoItem
  onUpdate: (updates: Partial<TodoItem>) => void
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(todo.title)
  const [editDuration, setEditDuration] = useState(todo.duration)

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
      className={`group flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-px ${isDragging ? 'shadow-lg z-10' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-none"
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
            className="flex-1 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:border-indigo-400"
            autoFocus
          />
          <DurationStepper value={editDuration} onChange={setEditDuration} small />
          <button
            onClick={saveEdit}
            className="text-indigo-500 hover:text-indigo-600 cursor-pointer"
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
            <p className="text-sm text-gray-800 truncate">{todo.title}</p>
          </div>
          <span className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
            {todo.duration}m
          </span>
          <button
            onClick={onDelete}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all cursor-pointer"
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

  return (
    <div className="flex flex-col h-full">
      {/* Add task card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4">
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a task..."
          className="w-full px-1 py-1.5 text-sm bg-transparent focus:outline-none placeholder-gray-400"
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
          <DurationStepper value={newDuration} onChange={setNewDuration} />
          <button
            onClick={handleAdd}
            disabled={!newTask.trim()}
            className="px-4 py-1.5 rounded-full bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {todos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs mt-1">Type a task above or use the microphone</p>
          </div>
        ) : (
          <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {todos.map((todo) => (
              <SortableTodoItem
                key={todo.id}
                todo={todo}
                onUpdate={(updates) => onUpdateTodo(todo.id, updates)}
                onDelete={() => onDeleteTodo(todo.id)}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
