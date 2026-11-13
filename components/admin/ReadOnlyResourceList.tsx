import {Layers} from 'lucide-react'
import {typeLabel} from '@/components/TypeLabel'
import {cx} from '@/lib/cx'
import type {CategoryGroup} from '@/lib/resources/group'
import type {Resource} from '@/lib/resources/types'
import {PreviewButton, previewHref} from './PreviewButton'
import {ResourceThumb} from './ResourceThumb'
import controls from './controls.module.css'
import panel from '@/app/(admin)/admin/(panel)/panel.module.css'
import styles from './SortableResourceList.module.css'

export function ReadOnlyResourceList({groups}: {groups: CategoryGroup<Resource>[]}) {
  return (
    <div className={styles.manager}>
      <header className={panel.pageHeader}>
        <h1 className={panel.pageTitle}>Resources</h1>
      </header>
      {groups.length === 0 ? (
        <div className={cx(controls.card, styles.empty)}>
          <Layers aria-hidden size={24} className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>No Resources Yet</h2>
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.key} className={cx(controls.surface, styles.group)}>
              <header className={styles.groupHeader}>
                <h2 className={styles.category}>{group.category}</h2>
              </header>
              <ul className={styles.rows}>
                {group.items.map((resource) => (
                  <li key={resource.id} className={cx(controls.row, styles.plainRow)}>
                    <ResourceThumb path={resource.coverImage?.path ?? resource.pdfPreview?.path} />
                    <span className={controls.rowTitle}>{resource.title}</span>
                    <span className={controls.hint}>{typeLabel(resource.type)}</span>
                    <PreviewButton href={previewHref(resource)} title={resource.title} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
