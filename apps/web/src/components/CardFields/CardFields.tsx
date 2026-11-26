import type { Ref } from 'react';
import type { Assignee, Card, Priority } from '@board/shared';
import { priorityNames } from '../CardTile/CardTile';
import styles from './CardFields.module.css';

export function readCardFields(form: HTMLFormElement) {
  const fields = new FormData(form);
  return {
    title: fields.get('title'),
    description: fields.get('description'),
    priority: fields.get('priority'),
    assigneeId: fields.get('assignee') || null,
    tags: String(fields.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
  };
}

export function CardFields({ card, titleRef, assignees, pending }: {
  card?: Card;
  titleRef: Ref<HTMLInputElement>;
  assignees: Assignee[];
  pending: boolean;
}) {
  return (
    <fieldset disabled={pending} className={styles.fields}>
      <label>Title<input ref={titleRef} name="title" defaultValue={card?.title} maxLength={120} required /></label>
      <label>Description<textarea name="description" defaultValue={card?.description} maxLength={2000} rows={4} /></label>
      <div className={styles.row}>
        <label>Priority<select name="priority" defaultValue={card?.priority ?? 'MEDIUM'}>
          {(Object.keys(priorityNames) as Priority[]).map((priority) => <option key={priority} value={priority}>{priorityNames[priority]}</option>)}
        </select></label>
        <label>Assignee<select name="assignee" defaultValue={card?.assigneeId ?? ''}>
          <option value="">Unassigned</option>
          {assignees.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select></label>
      </div>
      <label>Tags<input name="tags" placeholder="frontend, testing" defaultValue={card?.tags.join(', ')} /></label>
    </fieldset>
  );
}
