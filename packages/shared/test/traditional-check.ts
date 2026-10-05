import { toTraditional } from '../src/locale';
import { Converter } from 'opencc-js';
const simplify = Converter({ from: 'twp', to: 'cn' });
const traditional = toTraditional;
/** Reverse-check samples for exclusively simplified glyphs; shared characters such as 干 are valid Chinese. */
export function simplifiedResidue(text: string): string[] {
  const convertedText = traditional(text);
  const count = (value: string, char: string) => [...value].filter((c) => c === char).length;
  return [...new Set([...text])].filter((char) => {
    return (
      /\p{Script=Han}/u.test(char) &&
      simplify(char) === char &&
      count(convertedText, char) < count(text, char) &&
      [...convertedText].some((converted) => converted !== char && simplify(converted) === char)
    );
  });
}
