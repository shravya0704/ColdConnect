type Props = {
  value: string
  onChange: (value: string) => void
}

export default function DomainSelect({ value, onChange }: Props) {
  const domains = [
    'Software Engineering',
    'Data Science',
    'Product Management',
    'Design',
    'Marketing',
    'Sales',
  ]

  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">Domain / Role</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 transition"
      >
        {domains.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
    </label>
  )
}


