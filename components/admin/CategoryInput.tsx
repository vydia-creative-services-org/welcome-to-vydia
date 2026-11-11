'use client'
import {useState} from 'react'
import controls from './controls.module.css'
import styles from './CategoryInput.module.css'

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  categories: string[]
  invalid?: boolean
  describedBy?: string
}

const ADD_NEW = '__add_new__'

export function CategoryInput({id, value, onChange, categories, invalid, describedBy}: Props) {
  const [adding, setAdding] = useState(false)
  const isNew = adding || (value !== '' && !categories.includes(value))
  const common = {
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
    className: controls.input,
  }

  return (
    <div className={styles.wrap}>
      <select
        id={id}
        {...common}
        value={isNew ? ADD_NEW : value}
        onChange={(event) => {
          if (event.target.value === ADD_NEW) {
            setAdding(true)
            onChange('')
          } else {
            setAdding(false)
            onChange(event.target.value)
          }
        }}
      >
        <option value="">Select a category</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
        <option value={ADD_NEW}>+ Add new…</option>
      </select>
      {isNew && (
        <input
          value={value}
          autoFocus={adding}
          placeholder="New category name"
          aria-label="New category name"
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          {...common}
        />
      )}
    </div>
  )
}
