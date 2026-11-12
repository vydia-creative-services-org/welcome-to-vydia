import controls from '@/components/admin/controls.module.css'

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{display: 'grid', gap: 24}}>
      <div className={controls.skeleton} style={{width: 200, height: 32}} />
      <div className={controls.skeleton} style={{height: 56}} />
      <div className={controls.skeleton} style={{height: 320}} />
    </div>
  )
}
