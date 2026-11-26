import { useId, useState, type Ref } from 'react';
import type { Assignee, Card, Priority } from '@board/shared';
import { AssigneePicker } from '../AssigneePicker/AssigneePicker';
import { priorityNames } from '../CardTile/CardTile';
import { TagPicker } from '../TagPicker/TagPicker';
import styles from './CardFields.module.css';

export function readCardFields(form: HTMLFormElement) {
  const fields = new FormData(form);
  return {
    title: fields.get('title'),
    description: fields.get('description'),
    priority: fields.get('priority'),
    assigneeIds: fields.getAll('assignees'),
    tags: fields.getAll('tags'),
  };
}

export function CardFields({ card, titleRef, assignees, availableTags, pending }: {
  card?: Card;
  titleRef: Ref<HTMLInputElement>;
  assignees: Assignee[];
  availableTags: string[];
  pending: boolean;
}) {
  const id = useId();
  const [assigneeIds, setAssigneeIds] = useState(card?.assigneeIds ?? []);
  const [tags, setTags] = useState(card?.tags ?? []);
  return (
    <fieldset disabled={pending} className={styles.fields}>
      <div className={styles.field}>
        <label htmlFor={`${id}-title`}>Title</label>
        <input id={`${id}-title`} ref={titleRef} name="title" defaultValue={card?.title} maxLength={120} required />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-description`}>Description</label>
        <textarea id={`${id}-description`} name="description" defaultValue={card?.description} maxLength={2000} rows={4} />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-priority`}>Priority</label>
        <select id={`${id}-priority`} name="priority" defaultValue={card?.priority ?? 'MEDIUM'}>
          {(Object.keys(priorityNames) as Priority[]).map((priority) => <option key={priority} value={priority}>{priorityNames[priority]}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <span>Assignees</span>
        <AssigneePicker assignees={assignees} value={assigneeIds} onChange={setAssigneeIds} />
        {assigneeIds.map((assigneeId) => <input key={assigneeId} type="hidden" name="assignees" value={assigneeId} />)}
      </div>
      <div className={styles.tags}>
        <span>Tags</span>
        <TagPicker label="Tags" options={availableTags} value={tags} onChange={setTags} allowCreate />
        {tags.map((tag) => <input key={tag} type="hidden" name="tags" value={tag} />)}
      </div>
    </fieldset>
  );
}
