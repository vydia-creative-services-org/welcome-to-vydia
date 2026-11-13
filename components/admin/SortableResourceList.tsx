'use client'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVertical, Layers, Plus, Trash2} from 'lucide-react'
import {useOptimistic, useState, useTransition} from 'react'
import {deleteMainResource, reorderMainResources} from '@/app/(admin)/admin/(panel)/resources/actions'
import {typeLabel} from '@/components/TypeLabel'
import {cx} from '@/lib/cx'
import {draftFromResource, newDraft, type ResourceDraft} from '@/lib/admin/drafts'
import type {CategoryGroup} from '@/lib/resources/group'
import type {Resource} from '@/lib/resources/types'
import {ConfirmDialog} from './ConfirmDialog'
import controls from './controls.module.css'
import {ResourceDialog} from './ResourceDialog'
import {PreviewButton, previewHref} from './PreviewButton'
import {ResourceThumb} from './ResourceThumb'
import {useToast} from './Toaster'
import panel from '@/app/(admin)/admin/(panel)/panel.module.css'
import styles from './SortableResourceList.module.css'

type Groups = CategoryGroup<Resource>[]

type Props = {groups: Groups; categories: string[]}

const GROUP_PREFIX = 'group:'
const INSTRUCTIONS =
  'To pick up an item, press space or enter. Use the arrow keys to move it, then press space or enter again to drop it, or escape to cancel.'

const flatten = (groups: Groups) => groups.flatMap((group) => group.items.map((resource) => resource.id))

function announcements(names: Map<string, string>): Announcements {
  const name = (id: string | number) => names.get(String(id)) ?? 'item'
  return {
    onDragStart: ({active}) => `Picked up ${name(active.id)}.`,
    onDragOver: ({active, over}) => (over ? `${name(active.id)} is over ${name(over.id)}.` : undefined),
    onDragEnd: ({active, over}) =>
      over ? `Dropped ${name(active.id)} over ${name(over.id)}.` : `Dropped ${name(active.id)}.`,
    onDragCancel: ({active}) => `Moving ${name(active.id)} was cancelled.`,
  }
}

function useReorderSensors() {
  return useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 6}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  )
}

type RowProps = {
  resource: Resource
  onEdit: () => void
  onDelete: () => void
}

function ResourceRow({resource, onEdit, onDelete}: RowProps) {
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({
    id: resource.id,
  })
  return (
    <li
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging || undefined}
      style={{transform: CSS.Transform.toString(transform), transition}}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={styles.handle}
        aria-label={`Reorder ${resource.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden size={16} />
      </button>
      <button type="button" className={styles.open} onClick={onEdit}>
        <ResourceThumb path={resource.coverImage?.path ?? resource.pdfPreview?.path} />
        <span className={styles.title}>{resource.title}</span>
      </button>
      <span className={controls.hint}>{typeLabel(resource.type)}</span>
      <div className={styles.actions}>
        <PreviewButton href={previewHref(resource)} title={resource.title} />
        <button type="button" className={cx(controls.button, controls.ghost, controls.sm)} onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className={cx(controls.button, controls.ghost, controls.danger, controls.sm)}
          aria-label={`Delete ${resource.title}`}
          onClick={onDelete}
        >
          <Trash2 aria-hidden size={14} />
          Delete
        </button>
      </div>
    </li>
  )
}

type GroupProps = {
  group: CategoryGroup<Resource>
  onItems: (items: Resource[]) => void
  onEdit: (resource: Resource) => void
  onDelete: (resource: Resource) => void
}

function ResourceGroup({group, onItems, onEdit, onDelete}: GroupProps) {
  const sensors = useReorderSensors()
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({
    id: `${GROUP_PREFIX}${group.key}`,
  })
  const names = new Map(group.items.map((resource) => [resource.id, resource.title]))

  const onDragEnd = ({active, over}: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = group.items.findIndex((resource) => resource.id === active.id)
    const to = group.items.findIndex((resource) => resource.id === over.id)
    if (from >= 0 && to >= 0) onItems(arrayMove(group.items, from, to))
  }

  return (
    <section
      ref={setNodeRef}
      className={cx(controls.surface, styles.group)}
      data-dragging={isDragging || undefined}
      style={{transform: CSS.Transform.toString(transform), transition}}
      aria-label={group.category}
    >
      <header className={styles.groupHeader}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.handle}
          aria-label={`Reorder category ${group.category}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden size={16} />
        </button>
        <h2 className={styles.category}>{group.category}</h2>
      </header>
      <DndContext
        id={`items-${group.key}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{announcements: announcements(names), screenReaderInstructions: {draggable: INSTRUCTIONS}}}
      >
        <SortableContext items={group.items.map((resource) => resource.id)} strategy={verticalListSortingStrategy}>
          <ul className={styles.rows}>
            {group.items.map((resource) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                onEdit={() => onEdit(resource)}
                onDelete={() => onDelete(resource)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  )
}

export function SortableResourceList({groups, categories}: Props) {
  const [optimistic, setOptimistic] = useOptimistic(groups)
  const [editing, setEditing] = useState<{draft: ResourceDraft; isNew: boolean} | null>(null)
  const [deleting, setDeleting] = useState<Resource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const toast = useToast()
  const sensors = useReorderSensors()

  const apply = (next: Groups) =>
    startTransition(async () => {
      setOptimistic(next)
      setError(null)
      try {
        const result = await reorderMainResources(flatten(next))
        if (result.ok) toast('Order saved')
        else setError('Couldn’t save the new order. It has been put back.')
      } catch {
        setError('Couldn’t save the new order. It has been put back.')
      }
    })

  const onItems = (key: string) => (items: Resource[]) =>
    apply(optimistic.map((group) => (group.key === key ? {...group, items} : group)))

  const onGroupsEnd = ({active, over}: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = optimistic.findIndex((group) => `${GROUP_PREFIX}${group.key}` === active.id)
    const to = optimistic.findIndex((group) => `${GROUP_PREFIX}${group.key}` === over.id)
    if (from >= 0 && to >= 0) apply(arrayMove(optimistic, from, to))
  }

  const confirmDelete = () => {
    const target = deleting
    if (!target) return
    setDeleting(null)
    startTransition(async () => {
      try {
        const result = await deleteMainResource(target.id)
        if (result.ok) toast('Resource deleted')
        else setError('Couldn’t delete the resource. Nothing was changed.')
      } catch {
        setError('Couldn’t delete the resource. Nothing was changed.')
      }
    })
  }

  const groupNames = new Map(optimistic.map((group) => [`${GROUP_PREFIX}${group.key}`, group.category]))

  return (
    <div className={styles.manager}>
      <header className={panel.pageHeader}>
        <h1 className={panel.pageTitle}>Resources</h1>
        <button
          type="button"
          className={cx(controls.button, controls.primary)}
          onClick={() => setEditing({draft: newDraft(), isNew: true})}
        >
          <Plus aria-hidden size={14} />
          New resource
        </button>
      </header>

      {error && (
        <p role="alert" className={controls.notice}>
          {error}
        </p>
      )}

      {optimistic.length === 0 ? (
        <div className={cx(controls.card, styles.empty)}>
          <Layers aria-hidden size={24} className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>No Resources Yet</h2>
        </div>
      ) : (
        <DndContext
          id="categories"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onGroupsEnd}
          accessibility={{
            announcements: announcements(groupNames),
            screenReaderInstructions: {draggable: INSTRUCTIONS},
          }}
        >
          <SortableContext
            items={optimistic.map((group) => `${GROUP_PREFIX}${group.key}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className={styles.groups} aria-busy={pending || undefined}>
              {optimistic.map((group) => (
                <ResourceGroup
                  key={group.key}
                  group={group}
                  onItems={onItems(group.key)}
                  onEdit={(resource) => setEditing({draft: draftFromResource(resource), isNew: false})}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editing && (
        <ResourceDialog
          key={editing.draft.id}
          initial={editing.draft}
          isNew={editing.isNew}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.title ?? 'this resource'}?`}
        body="It’s removed from every client’s page."
        confirmLabel="Delete resource"
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
