type Tone = 'Formal' | 'Neutral' | 'Friendly' | 'Bold'

type Props = {
  value: Tone
  onChange: (value: Tone) => void
}

export default function ToneSelect({ value, onChange }: Props) {
  const tones: Tone[] = ['Formal', 'Neutral', 'Friendly', 'Bold']
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">Tone</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Tone)}
        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 transition"
      >
        {tones.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </label>
  )
}


