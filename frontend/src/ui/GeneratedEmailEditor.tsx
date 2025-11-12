type Props = {
  subject: string
  onSubjectChange: (value: string) => void
  body: string
  onBodyChange: (value: string) => void
  children?: React.ReactNode
}

export default function GeneratedEmailEditor({ subject, onSubjectChange, body, onBodyChange, children }: Props) {
  return (
    <div className="card flex flex-col">
      <h2 className="text-lg font-semibold mb-4">Generated Email</h2>
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Subject</span>
        <input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Subject"
        />
      </label>
      <label className="block mt-4 flex-1">
        <span className="block text-sm font-medium text-gray-700 mb-1">Body</span>
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={12}
          style={{minHeight: '280px'}}
        />
      </label>
      {children}
    </div>
  )
}


