import { useState } from 'react'
import type { Settings } from '../types'

interface SettingsModalProps {
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
  googleConnected: boolean
  onConnectGoogle: () => void
  onDisconnectGoogle: () => void
}

export default function SettingsModal({
  settings,
  onSave,
  onClose,
  googleConnected,
  onConnectGoogle,
  onDisconnectGoogle,
}: SettingsModalProps) {
  const [local, setLocal] = useState<Settings>({ ...settings })

  function handleSave() {
    onSave(local)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configure your API keys and integrations</p>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={local.openaiApiKey}
              onChange={(e) => setLocal((s) => ({ ...s, openaiApiKey: e.target.value }))}
              placeholder="sk-..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1">Used for voice transcription (Whisper) and AI features</p>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Google Calendar</p>
                <p className="text-xs text-gray-400">
                  {googleConnected ? 'Connected' : 'Not connected'}
                </p>
              </div>
              {googleConnected ? (
                <button
                  onClick={onDisconnectGoogle}
                  className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => {
                    onSave(local)
                    onConnectGoogle()
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
