import controls from './controls.module.css'

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  categories: string[]
  invalid?: boolean
  describedBy?: string
}

export function CategoryInput({id, value, onChange, categories, invalid, describedBy}: Props) {
  return (
    <>
      <input
        id={id}
        list={`${id}-list`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={controls.input}
      />
      <datalist id={`${id}-list`}>
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
    </>
  )
}
