/**
 * Unsaved journal edits, kept in memory only (never written outside the encrypted store) so that
 * switching days, pull-to-refresh or leaving the tab cannot silently discard what was typed.
 */
export interface JournalDraft {
  mood: number | null;
  text: string;
}
const drafts = new Map<string, JournalDraft>();
const draftKey = (profileId: string, date: string) => `${profileId}|${date}`;

export function readJournalDraft(profileId: string, date: string): JournalDraft | undefined {
  return drafts.get(draftKey(profileId, date));
}
export function writeJournalDraft(profileId: string, date: string, draft: JournalDraft) {
  drafts.set(draftKey(profileId, date), draft);
}
export function clearJournalDraft(profileId: string, date: string) {
  drafts.delete(draftKey(profileId, date));
}
