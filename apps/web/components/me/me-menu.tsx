import {
  BookHeart,
  ChevronRight,
  CreditCard,
  History,
  Settings,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
type Item = 'birth' | 'profiles' | 'history' | 'journal' | 'settings' | 'billing';
const icons: Record<Item, LucideIcon> = {
  birth: UserRound,
  profiles: UsersRound,
  history: History,
  journal: BookHeart,
  settings: Settings,
  billing: CreditCard,
};
/** Account menu as full-width tappable rows; anonymous visitors learn why multi-profile needs sign-in. */
export async function MeMenu({ signedIn, billing }: { signedIn: boolean; billing: boolean }) {
  const t = await getCopy();
  const items: Item[] = ['birth', 'profiles', 'history', 'journal', 'settings'];
  if (billing) items.push('billing');
  return (
    <nav className="report-card me-menu" aria-label={t('nav.me')}>
      <ul>
        {items.map((item) => {
          const Icon = icons[item];
          // The profile manager redirects anonymous visitors to sign-in and back again.
          const hint = item === 'profiles' && !signedIn ? t('profiles.signInForMore') : null;
          return (
            <li key={item}>
              <Link href={`/me/${item}`} className="me-menu-row">
                <Icon size={20} aria-hidden className="me-menu-icon" />
                <span className="me-menu-text">
                  <span>{t(`me.${item}`)}</span>
                  {hint ? <span className="muted type-small">{hint}</span> : null}
                </span>
                <ChevronRight size={18} aria-hidden className="me-menu-chevron" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
