// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getDisclaimerAcknowledgementAction: vi.fn<() => Promise<boolean>>(),
  acknowledgeDisclaimerAction: vi.fn<() => Promise<void>>(),
}));
vi.mock('../app/me/actions', () => actions);

// The store keeps per-visit state at module level, so every test starts from a fresh module.
async function load() {
  vi.resetModules();
  return import('../lib/consent');
}

beforeEach(() => {
  // DESIGN-GAP: Node 25 exposes a partial native localStorage; isolate a complete Web Storage implementation for jsdom.
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  });
  vi.clearAllMocks();
  actions.getDisclaimerAcknowledgementAction.mockResolvedValue(false);
  actions.acknowledgeDisclaimerAction.mockResolvedValue(undefined);
});

describe('first-reading consent', () => {
  it('does not ask a visitor who already confirmed on this device', async () => {
    localStorage.setItem('tianji-disclaimer-v1', 'accepted');
    const consent = await load();
    await expect(consent.ensureConsent()).resolves.toBe(true);
    expect(consent.isConsentPromptOpen()).toBe(false);
    expect(actions.getDisclaimerAcknowledgementAction).not.toHaveBeenCalled();
  });

  it('does not ask an account that already confirmed, and remembers it on the device', async () => {
    actions.getDisclaimerAcknowledgementAction.mockResolvedValue(true);
    const consent = await load();
    await expect(consent.ensureConsent()).resolves.toBe(true);
    expect(consent.isConsentPromptOpen()).toBe(false);
    expect(localStorage.getItem('tianji-disclaimer-v1')).toBe('accepted');
  });

  it('asks once, then continues and records the confirmation', async () => {
    const consent = await load();
    const proceed = vi.fn();
    consent.afterConsent(proceed);
    const second = consent.ensureConsent();
    await vi.waitFor(() => expect(consent.isConsentPromptOpen()).toBe(true));
    expect(proceed).not.toHaveBeenCalled();
    consent.confirmConsent();
    await expect(second).resolves.toBe(true);
    await vi.waitFor(() => expect(proceed).toHaveBeenCalledOnce());
    expect(localStorage.getItem('tianji-disclaimer-v1')).toBe('accepted');
    expect(actions.acknowledgeDisclaimerAction).toHaveBeenCalledOnce();
    await expect(consent.ensureConsent()).resolves.toBe(true);
  });

  it('leaves the action unstarted and unrecorded when declined', async () => {
    const consent = await load();
    const proceed = vi.fn();
    consent.afterConsent(proceed);
    await vi.waitFor(() => expect(consent.isConsentPromptOpen()).toBe(true));
    consent.declineConsent();
    await vi.waitFor(() => expect(consent.isConsentPromptOpen()).toBe(false));
    await Promise.resolve();
    expect(proceed).not.toHaveBeenCalled();
    expect(localStorage.getItem('tianji-disclaimer-v1')).toBeNull();
    expect(actions.acknowledgeDisclaimerAction).not.toHaveBeenCalled();
  });

  it('asks when the account lookup fails', async () => {
    actions.getDisclaimerAcknowledgementAction.mockRejectedValue(new Error('offline'));
    const consent = await load();
    void consent.ensureConsent();
    await vi.waitFor(() => expect(consent.isConsentPromptOpen()).toBe(true));
    consent.declineConsent();
  });

  it('treats dismissing the notice as hiding it, never as an age confirmation', async () => {
    const consent = await load();
    consent.dismissNotice();
    expect(consent.isNoticeDismissed()).toBe(true);
    expect(consent.hasDeviceConsent()).toBe(false);
    void consent.ensureConsent();
    await vi.waitFor(() => expect(consent.isConsentPromptOpen()).toBe(true));
    consent.declineConsent();
  });

  it('survives blocked storage for the rest of the visit', async () => {
    const consent = await load();
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    void consent.ensureConsent();
    await vi.waitFor(() => expect(consent.isConsentPromptOpen()).toBe(true));
    consent.confirmConsent();
    await expect(consent.ensureConsent()).resolves.toBe(true);
  });
});
