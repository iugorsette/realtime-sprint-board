type Segment = { text: string; changed: boolean };

export function compareText(draft: string, server: string) {
  const tokenize = (text: string) => text.match(/\s+|[\p{L}\p{N}\p{M}]+|[^\s]/gu) ?? [];
  const yours = tokenize(draft);
  const theirs = tokenize(server);
  const lengths = Array.from({ length: yours.length + 1 }, () => new Uint16Array(theirs.length + 1));
  for (let i = yours.length - 1; i >= 0; i--) {
    for (let j = theirs.length - 1; j >= 0; j--) {
      lengths[i][j] = yours[i] === theirs[j] ? 1 + lengths[i + 1][j + 1]
        : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const local: Segment[] = [];
  const remote: Segment[] = [];
  function append(segments: Segment[], text: string, changed: boolean) {
    const last = segments.at(-1);
    if (last?.changed === changed) last.text += text;
    else segments.push({ text, changed });
  }

  let i = 0;
  let j = 0;
  while (i < yours.length || j < theirs.length) {
    if (i < yours.length && j < theirs.length && yours[i] === theirs[j]) {
      append(local, yours[i++], false);
      append(remote, theirs[j++], false);
    } else if (i < yours.length && (j === theirs.length || lengths[i + 1][j] >= lengths[i][j + 1])) {
      append(local, yours[i++], true);
    } else {
      append(remote, theirs[j++], true);
    }
  }
  return { local, remote };
}
