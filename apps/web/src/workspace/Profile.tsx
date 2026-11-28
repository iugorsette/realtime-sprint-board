import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Account } from '@board/shared';
import { BoardDialog } from '../components/BoardDialog/BoardDialog';
import { errorMessage, saveProfile } from './api';
import styles from './Workspace.module.css';

async function encodeAvatar(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
    throw new Error('Choose a PNG, JPEG, or WebP image under 5 MB.');
  }
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable.');
    const side = Math.min(image.width, image.height);
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 128, 128);
    const encoded = canvas.toDataURL('image/png').split(',')[1];
    if (!encoded || encoded.length > 87_384) throw new Error('Choose a smaller image.');
    return encoded;
  } finally {
    image.close();
  }
}

export function Profile({ account, onSave, onClose, onLogout, logoutPending, logoutError }: {
  account: Account;
  onSave: (account: Account) => void;
  onClose: () => void;
  onLogout: () => void;
  logoutPending: boolean;
  logoutError?: string;
}) {
  const [name, setName] = useState(account.name);
  const [avatar, setAvatar] = useState<string | null>();
  const [reading, setReading] = useState(false);
  const [imageError, setImageError] = useState('');
  const save = useMutation({ mutationFn: () => saveProfile(name, avatar), onSuccess: onSave });
  const image = avatar === undefined ? account.avatar : avatar;
  return (
    <BoardDialog title="Profile" onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <p>{account.email}</p>
        <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required /></label>
        {image && <img className={styles.avatar} width="64" height="64" src={'data:image/png;base64,' + image} alt="Your profile picture" />}
        <label>Profile picture<input type="file" accept="image/png,image/jpeg,image/webp" disabled={reading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setReading(true);
            setImageError('');
            try { setAvatar(await encodeAvatar(file)); }
            catch (error) { setImageError(error instanceof Error ? error.message : 'Could not open this image.'); }
            finally { setReading(false); }
          }} /></label>
        {image && <button type="button" onClick={() => setAvatar(null)}>Remove picture</button>}
        {imageError && <p role="alert" className={styles.error}>{imageError}</p>}
        {save.error && <p role="alert" className={styles.error}>{errorMessage(save.error)}</p>}
        {logoutError && <p role="alert" className={styles.error}>{logoutError}</p>}
        <div className={styles.actions}>
          <button type="button" disabled={logoutPending} onClick={onLogout}>Sign out</button>
          <button type="submit" disabled={reading || save.isPending || logoutPending} className={styles.primary}>Save profile</button>
        </div>
      </form>
    </BoardDialog>
  );
}
