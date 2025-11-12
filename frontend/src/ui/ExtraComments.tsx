type Props = {
  value: string
  onChange: (value: string) => void
}

export default function ExtraComments({ value, onChange }: Props) {
  return (
    <label className="block w-full">
      <span className="block text-sm font-medium text-gray-700 mb-1">Extra Comments</span>
      <textarea
        placeholder="Anything else we should consider?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 transition"
      />
    </label>
  )
}


