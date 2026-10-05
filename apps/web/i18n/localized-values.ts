import { brand } from '@tianji/shared/brand';
/** Taiwan conversion applies to editorial prose and configured brand names, not personal inputs. */
export function localizedValues(
  key: string,
  values: Record<string, string | number | Date> | undefined,
  locale: string,
) {
  if (locale !== 'zh-TW' || !values) return values;
  const fields =
    key === 'brand.nameZh' ? ['name'] : key === 'common.brandTitle' ? ['nameZh'] : ['brand'];
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [
      field,
      fields.includes(field) && value === brand.nameZh ? brand.nameZhTW : value,
    ]),
  );
}
