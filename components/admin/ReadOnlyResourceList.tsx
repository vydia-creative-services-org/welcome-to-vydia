import {typeLabel} from '@/components/TypeLabel'
import type {CategoryGroup} from '@/lib/resources/group'
import type {Resource} from '@/lib/resources/types'
import controls from './controls.module.css'
import panel from '@/app/(admin)/admin/(panel)/panel.module.css'
import styles from './SortableResourceList.module.css'

export function ReadOnlyResourceList({groups}: {groups: CategoryGroup<Resource>[]}) {
  return (
    <div className={styles.manager}>
      <header className={panel.pageHeader}>
        <h1 className={panel.pageTitle}>Resources</h1>
      </header>
      <p className={controls.hint}>
        Core resources appear on every client page. Only super admins can change them. You can hide one for a specific
        client from that client’s page.
      </p>
      {groups.length === 0 ? (
        <div className={`${controls.card} ${styles.empty}`}>
          <p className={styles.emptyTitle}>No resources yet</p>
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.key} className={`${controls.card} ${styles.group}`}>
              <h2 className={styles.category}>{group.category}</h2>
              <ul className={styles.rows}>
                {group.items.map((resource) => (
                  <li key={resource.id} className={controls.row}>
                    <span className={controls.rowTitle}>{resource.title}</span>
                    <span className={controls.hint}>{typeLabel(resource.type)}</span>
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
