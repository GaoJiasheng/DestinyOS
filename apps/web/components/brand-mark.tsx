import { brand } from '@tianji/shared/brand';
import { getCopy } from '@/i18n/get-copy';
/** Render brand names exclusively from the shared brand configuration via next-intl. */
export async function BrandMark() {
  const t = await getCopy();
  return (
    <span className="brand-mark">
      <span className="brand-zh">{t('brand.nameZh', { name: brand.nameZh })}</span>
      <span className="brand-en">{t('brand.nameEn', { name: brand.nameEn })}</span>
    </span>
  );
}
