import { acknowledgeDisclaimerAction, getDisclaimerAcknowledgementAction } from '@/app/me/actions';

/** The age + disclaimer confirmation shared with the account's `disclaimerAcceptedAt`. */
const consentKey = 'tianji-disclaimer-v1';
/** Dismissing the notice bar is not an age confirmation, so it is stored separately. */
const noticeKey = 'tianji-disclaimer-notice-v1';
const accountLookupLimitMs = 2000;

// DESIGN-GAP: Blocked storage must not make a visitor confirm again on every action during one visit.
let confirmedThisVisit = false;
let noticeDismissedThisVisit = false;
let accountLookup: Promise<boolean> | null = null;
let prompt: Promise<boolean> | null = null;
let settle: ((confirmed: boolean) => void) | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* The in-memory flag keeps this visit usable when storage is blocked. */
  }
};

export const subscribeConsent = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const isConsentPromptOpen = () => prompt !== null;
export const hasDeviceConsent = () => confirmedThisVisit || read(consentKey) === 'accepted';
export const isNoticeDismissed = () => noticeDismissedThisVisit || read(noticeKey) === 'dismissed';

export function dismissNotice() {
  noticeDismissedThisVisit = true;
  write(noticeKey, 'dismissed');
}

function remember() {
  confirmedThisVisit = true;
  write(consentKey, 'accepted');
  notify();
}

/** Ask the account once per navigation; the prompt reuses the answer so anonymous visitors wait for nothing. */
export function refreshAccountConsent() {
  accountLookup = getDisclaimerAcknowledgementAction()
    .then((accepted) => {
      if (accepted) remember();
      return accepted;
    })
    .catch(() => false);
  return accountLookup;
}

function finish(confirmed: boolean) {
  settle?.(confirmed);
  settle = null;
  prompt = null;
  notify();
}

export function confirmConsent() {
  remember();
  void acknowledgeDisclaimerAction().catch(() => undefined);
  finish(true);
}
export const declineConsent = () => finish(false);

/**
 * Resolve once the visitor has confirmed age and disclaimer, asking in place the first time.
 * @returns false when the visitor declined; callers leave their form untouched.
 */
export async function ensureConsent(): Promise<boolean> {
  if (hasDeviceConsent()) return true;
  if (prompt) return prompt;
  // DESIGN-GAP: A slow or failed account lookup falls through to asking, which is the safe outcome.
  const known = await Promise.race([
    accountLookup ?? refreshAccountConsent(),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), accountLookupLimitMs)),
  ]);
  if (known || hasDeviceConsent()) return true;
  prompt ??= new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  notify();
  return prompt;
}

/** Continue the original action after consent, outside its busy state so nothing shows behind the dialog. */
export function afterConsent(proceed: () => void) {
  void ensureConsent().then((confirmed) => {
    if (confirmed) proceed();
  });
}
