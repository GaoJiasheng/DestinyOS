import { Link } from '@/i18n/navigation';

/**
 * One clear "add your birth details" call to action for profile-less daily and calendar views.
 * @param from Locale-free path to return to after the profile is saved (handled by the birth form).
 */
export function DailyProfileCta({
  title,
  body,
  action,
  from,
}: {
  title: string;
  body: string;
  action: string;
  from: '/today' | '/today/calendar';
}) {
  return (
    <section className="report-card daily-cta" data-daily-cta>
      <h2>{title}</h2>
      <p>{body}</p>
      <Link href={{ pathname: '/me/birth', query: { from } }} className="button button-primary">
        {action}
      </Link>
    </section>
  );
}
