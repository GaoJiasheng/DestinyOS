import type { ComponentProps } from 'react';
// eslint-disable-next-line no-restricted-imports -- This wrapper is the single place allowed to hand catalogs to the client.
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { precompileMessages } from './precompile';

type Props = Omit<ComponentProps<typeof NextIntlClientProvider>, 'messages'> & {
  messages: AbstractIntlMessages;
};

/** Server-only client provider: the browser bundle has no ICU parser, so catalogs cross the boundary precompiled. */
export function ClientMessages({ messages, ...props }: Props) {
  return <NextIntlClientProvider {...props} messages={precompileMessages(messages)} />;
}
