import { useState, type Ref } from 'react';
import type { Assignee, Card, Priority } from '@board/shared';
import { priorityNames } from '../CardTile/CardTile';
import { TagPicker } from '../TagPicker/TagPicker';
import styles from './CardFields.module.css';

export function readCardFields(form: HTMLFormElement) {
  const fields = new FormData(form);
  return {
    title: fields.get('title'),
    description: fields.get('description'),
    priority: fields.get('priority'),
    assigneeId: fields.get('assignee') || null,
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
  const [tags, setTags] = useState(card?.tags ?? []);
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
      <div className={styles.tags}>
        <span>Tags</span>
        <TagPicker label="Tags" options={availableTags} value={tags} onChange={setTags} allowCreate />
        {tags.map((tag) => <input key={tag} type="hidden" name="tags" value={tag} />)}
      </div>
    </fieldset>
  );
}
