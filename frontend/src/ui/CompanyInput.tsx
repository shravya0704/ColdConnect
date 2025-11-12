type Props = {
  value: string
  onChange: (value: string) => void
}

export default function CompanyInput({ value, onChange }: Props) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">Company</span>
      <input
        type="text"
        placeholder="Acme Corp"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 transition"
      />
    </label>
  )
}


