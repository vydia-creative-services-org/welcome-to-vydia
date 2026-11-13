import {Layers} from 'lucide-react'
import {cx} from '@/lib/cx'
import type {CategoryGroup} from '@/lib/resources/group'
import type {Resource} from '@/lib/resources/types'
import {previewAction, RowActions} from './RowActions'
import {previewHref} from './preview'
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
                    <RowActions name={resource.title} actions={[previewAction(previewHref(resource))]} />
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
