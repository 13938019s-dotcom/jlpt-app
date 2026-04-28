import { useState } from 'react';

interface Props {
  onSubmit: (key: string) => void;
  onCancel: () => void;
}

export function ApiKeyModal({ onSubmit, onCancel }: Props) {
  const [key, setKey] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-black text-gray-900 mb-2">輸入 Anthropic API Key</h2>
        <p className="text-gray-500 text-sm mb-4">
          API Key 僅在本次使用，不會被儲存。請前往{' '}
          <span className="text-purple-600 font-medium">console.anthropic.com</span>{' '}
          取得您的 API Key。
        </p>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:border-purple-400 focus:outline-none mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => key.trim() && onSubmit(key.trim())}
            disabled={!key.trim()}
            className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            確認生成
          </button>
        </div>
      </div>
    </div>
  );
}
