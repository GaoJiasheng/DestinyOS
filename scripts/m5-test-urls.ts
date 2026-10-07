// DESIGN-GAP: Concurrent worktrees can occupy M5's fixed ports; one explicit offset
// keeps its browser, mail and Stripe mocks together without reusing another server.
export const m5PortOffset = Number(process.env.TEST_M5_PORT_OFFSET ?? 0);
if (!Number.isInteger(m5PortOffset) || m5PortOffset < 0 || m5PortOffset > 5000)
  throw new Error('TEST_M5_PORT_OFFSET must be an integer between 0 and 5000');
export const m5WebPort = 3230 + m5PortOffset;
export const m5MailPort = 60201 + m5PortOffset;
export const m5StripePort = 60302 + m5PortOffset;
export const m5BaseURL = `http://localhost:${m5WebPort}`;
export const m5MailURL = `http://127.0.0.1:${m5MailPort}/mail`;
export const m5StripeURL = `http://127.0.0.1:${m5StripePort}`;
