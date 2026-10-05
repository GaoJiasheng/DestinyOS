// DESIGN-GAP: Next.js normalizes repeated --import options; one preload installs tsx then the isolated interceptor.
import 'tsx';
await import('./test-chat-interceptor.ts');
