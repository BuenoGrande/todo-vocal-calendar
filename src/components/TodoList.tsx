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
  const [editDuration, setEditDuration] = useState(String(todo.duration))

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function saveEdit() {
    const dur = parseInt(editDuration, 10)
    onUpdate({
      title: editTitle.trim() || todo.title,
      duration: dur > 0 ? dur : todo.duration,
    })
    setIsEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl border border-gray-100 hover:border-gray-200 shadow-sm transition-all ${isDragging ? 'shadow-lg z-10' : ''}`}
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
          <input
            value={editDuration}
            onChange={(e) => setEditDuration(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
            type="number"
            min="1"
            className="w-14 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:border-indigo-400 text-center"
          />
          <span className="text-xs text-gray-400">min</span>
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
            onClick={() => setIsEditing(true)}
          >
            <p className="text-sm text-gray-800 truncate">{todo.title}</p>
          </div>
          <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
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
  const [newDuration, setNewDuration] = useState('30')

  function handleAdd() {
    const title = newTask.trim()
    if (!title) return
    const dur = parseInt(newDuration, 10)
    onAddTodo(title, dur > 0 ? dur : 30)
    setNewTask('')
    setNewDuration('30')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Add task input */}
      <div className="flex items-center gap-2 mb-4">
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a task..."
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
        />
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
          <input
            value={newDuration}
            onChange={(e) => setNewDuration(e.target.value)}
            type="number"
            min="1"
            className="w-10 text-sm text-center focus:outline-none"
          />
          <span className="text-xs text-gray-400">min</span>
        </div>
        <button
          onClick={handleAdd}
          disabled={!newTask.trim()}
          className="w-9 h-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
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
