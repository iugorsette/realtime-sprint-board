import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { cardEvents, type ClientToServerEvents, type ServerToClientEvents } from '@board/shared';
import type { CardAction } from './api';
import type { OfflineStore } from './offline';
import { BoardSync } from './sync';

type BoardSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type Connection = 'connecting' | 'live' | 'offline';

export function useBoard(boardId: string, store: OfflineStore, offline: boolean) {
  const client = useQueryClient();
  const sync = useMemo(() => new BoardSync(client, boardId, (board) => {
    void store.saveSnapshot(board).catch(() => undefined);
  }), [client, boardId, store]);
  const query = useQuery({ ...sync.options, enabled: false, initialData: () => store.snapshot() });
  const socketRef = useRef<BoardSocket>(null);
  const [connection, setConnection] = useState<Connection>('connecting');

  useEffect(() => {
    if (offline) return;
    sync.start();
    const socket: BoardSocket = io({ autoConnect: false, transports: ['websocket'] });
    socketRef.current = socket;
    const receive = sync.receive.bind(sync);
    const refresh = () => sync.resync();
    let joinRetry: ReturnType<typeof setTimeout> | undefined;
    const join = () => {
      clearTimeout(joinRetry);
      setConnection('connecting');
      const socketId = socket.id;
      socket.timeout(3000).emit('board:join', boardId, (error, result) => {
        if (!socket.connected || socket.id !== socketId) return;
        setConnection(!error && result.ok ? 'live' : 'offline');
        sync.resync();
        if (error) joinRetry = setTimeout(join, 1000);
      });
    };
    const disconnected = () => {
      clearTimeout(joinRetry);
      setConnection('offline');
      sync.resync();
    };
    setConnection('connecting');
    for (const event of cardEvents) socket.on(event, receive);
    socket.on('board:refresh', refresh);
    socket.on('connect', join);
    socket.on('disconnect', disconnected);
    socket.on('connect_error', disconnected);
    socket.connect();
    window.addEventListener('online', refresh);
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener('online', refresh);
      window.clearInterval(interval);
      clearTimeout(joinRetry);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      sync.stop();
    };
  }, [boardId, offline, sync]);

  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: (action: CardAction) => sync.mutate(action, socketRef.current?.id),
  });

  return {
    query, mutation, connection, retry: () => sync.resync(),
    acceptSnapshot: (board: NonNullable<typeof query.data>) => {
      client.setQueryData(sync.options.queryKey, (current) =>
        current && current.revision > board.revision ? current : board);
    },
  };
}
