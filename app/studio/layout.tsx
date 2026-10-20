import styles from './layout.module.css'

export default function StudioLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className={styles.body}>{children}</body>
    </html>
  )
}
