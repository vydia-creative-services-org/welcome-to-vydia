import styles from './Notice.module.css'

export function Notice({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={styles.notice}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.body}>{children}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
