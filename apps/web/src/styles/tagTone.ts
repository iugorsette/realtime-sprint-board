export function tagTone(tag: string) {
  return Array.from(tag).reduce((total, character) => total + (character.codePointAt(0) ?? 0), 0) % 4;
}
