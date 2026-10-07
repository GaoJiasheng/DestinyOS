import { notFound } from 'next/navigation';
import { assertActiveShare } from '@/lib/share-service';
import { ApiError } from '@/lib/api-error';
/** Reject unavailable shares outside the page's skeleton, before response headers stream. */
export default async function ShareAvailabilityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  try {
    await assertActiveShare((await params).token);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'E_NOT_FOUND') notFound();
    throw error;
  }
  return children;
}
