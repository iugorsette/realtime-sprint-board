import { useCallback, useEffect, useRef, useState } from 'react';

type CardLink = { id: string };

export function readCardId(url: URL): string | undefined {
  return url.searchParams.get('cardId') ?? undefined;
}

export function cardUrl(href: string, card?: CardLink): URL {
  const url = new URL(href);
  if (card) url.searchParams.set('cardId', card.id);
  else url.searchParams.delete('cardId');
  url.searchParams.delete('slug');
  return url;
}

function currentCardId() {
  return readCardId(new URL(window.location.href));
}

function replaceWithBoardUrl() {
  window.history.replaceState({ ...window.history.state, openedFromBoard: false }, '', cardUrl(window.location.href));
}

export function useCardLocation(onHistoryCard: () => void) {
  const [selectedLinkId, setSelectedLinkId] = useState(currentCardId);
  const goingBack = useRef(false);

  useEffect(() => {
    function onPopState() {
      goingBack.current = false;
      const id = currentCardId();
      if (id) onHistoryCard();
      setSelectedLinkId(id);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [onHistoryCard]);

  const openCardLink = useCallback((card: CardLink) => {
    const current = currentCardId();
    if (goingBack.current || current === card.id) return;
    if (current !== undefined) replaceWithBoardUrl();
    window.history.pushState({ ...window.history.state, openedFromBoard: true }, '', cardUrl(window.location.href, card));
    setSelectedLinkId(card.id);
  }, []);

  const dismissCard = useCallback((id: string, replace = false) => {
    if (goingBack.current || currentCardId() !== id) return;
    if (!replace && window.history.state?.openedFromBoard) {
      goingBack.current = true;
      window.history.back();
      return;
    }
    replaceWithBoardUrl();
    setSelectedLinkId(undefined);
  }, []);

  return { selectedLinkId, openCardLink, dismissCard };
}
