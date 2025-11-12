import { useState } from 'react'

export default function AttachResume() {
  const [files, setFiles] = useState<File[]>([])

  function handleFiles(list: FileList | null) {
    if (!list) return
    const next = Array.from(list).slice(0, 5)
    setFiles(next)
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Attach Resume / Projects</h2>
      <label className="file-upload">
        <input type="file" className="hidden" multiple onChange={(e) => handleFiles(e.target.files)} />
        <span className="text-sm text-gray-600">Drop files here or click to upload</span>
      </label>
      {files.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm text-gray-700">
          {files.map((f) => (
            <li key={f.name} className="flex items-center justify-between">
              <span className="truncate max-w-[70%]">{f.name}</span>
              <span className="text-gray-400">{Math.round(f.size / 1024)} KB</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


