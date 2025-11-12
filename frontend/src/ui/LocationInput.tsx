type Props = {
  value: string
  onChange: (value: string) => void
}

export default function LocationInput({ value, onChange }: Props) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">Location</span>
      <input
        type="text"
        placeholder="San Francisco, CA"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 transition"
      />
    </label>
  )
}


