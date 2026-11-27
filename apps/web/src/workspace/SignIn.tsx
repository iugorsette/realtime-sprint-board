import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Account } from '@board/shared';
import { errorMessage, sendCode, verifyCode } from './api';
import styles from './Workspace.module.css';

export function SignIn({ onSignIn }: { onSignIn: (account: Account) => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [requested, setRequested] = useState(false);
  const request = useMutation({ mutationFn: () => sendCode(email), onSuccess: () => setRequested(true) });
  const verify = useMutation({ mutationFn: () => verifyCode(email, code), onSuccess: onSignIn });
  const pending = request.isPending || verify.isPending;
  const failure = request.error ?? verify.error;

  return (
    <main className={styles.entry}>
      <h1>Sprint Board</h1>
      <form className={styles.form} onSubmit={(event) => {
        event.preventDefault();
        if (requested) verify.mutate();
        else request.mutate();
      }}>
        <h2>{requested ? 'Check your email' : 'Sign in or create an account'}</h2>
        {requested ? (
          <>
            <p>Enter the six-digit code sent to {email}.</p>
            <label>Sign-in code<input type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
              maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value)} /></label>
          </>
        ) : <label>Email<input type="email" autoComplete="email" required value={email}
          maxLength={254} onChange={(event) => setEmail(event.target.value)} /></label>}
        {failure && <p role="alert" className={styles.error}>{errorMessage(failure)}</p>}
        <button className={styles.primary} type="submit" disabled={pending}>{pending ? 'Please wait…' : requested ? 'Sign in' : 'Send code'}</button>
        {requested && <div className={styles.actions}>
          <button type="button" disabled={pending} onClick={() => {
            verify.reset();
            request.reset();
            setRequested(false);
            setCode('');
          }}>Use another email</button>
          <button type="button" disabled={pending} onClick={() => { verify.reset(); request.mutate(); }}>Resend code</button>
        </div>}
      </form>
    </main>
  );
}
