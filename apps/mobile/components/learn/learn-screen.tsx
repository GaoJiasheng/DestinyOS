import { spacing } from '@tianji/ui-core/tokens';
import { useState } from 'react';
import { View, Image, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';
import {
  LearnSystemsSchema,
  LearnCardsSchema,
  LearnHexagramsSchema,
  LearnArticlesSchema,
} from '@tianji/content';
import { sourceLocale, localeText } from '@tianji/shared/locale';
// DESIGN-GAP: The shared content compiler emits its public artifact under Web resources; bundle that same artifact offline instead of copying editorial sources.
import compiled from '../../../web/resources/learn.json';
import { bundledKnowledge } from '../../lib/knowledge/bundled';
import { usePreferences } from '../../lib/preferences';
import { useCopy } from '../../lib/copy';
import { useTheme } from '../../lib/theme';
import { tarotImages } from '../../lib/reports/tarot-images';
import { Page, Action, CopyText, Field } from '../native-ui';
import { ReportCard } from '../report/report-ui';
const content = z
  .object({
    systems: LearnSystemsSchema,
    cards: LearnCardsSchema,
    hexagrams: LearnHexagramsSchema,
    articles: LearnArticlesSchema,
  })
  .parse(compiled);
const categories = ['systems', 'hexagrams', 'cards', 'glossary', 'tutorials'] as const;
type Category = (typeof categories)[number];
/** Offline encyclopedia routes use compiled bilingual package content, shared assets and next-intl prose boundaries. */
export function LearnScreen() {
  const { system, entry, slug } = useLocalSearchParams<{
      system?: string;
      entry?: string;
      slug?: string;
    }>(),
    router = useRouter();
  const t = useCopy(),
    locale = usePreferences((s) => s.locale),
    language = sourceLocale(locale),
    { colors } = useTheme();
  const [category, setCategory] = useState<Category>('systems'),
    [search, setSearch] = useState(''),
    [original, setOriginal] = useState(false);
  const prose = (text: string) => t('report.content', { text: localeText(text, locale) });
  const block = (title: string, text: string, id?: string) => (
    <ReportCard key={title} id={id}>
      <CopyText title>{title}</CopyText>
      <CopyText>{prose(text)}</CopyText>
    </ReportCard>
  );
  const tutorial = content.articles.find((a) => a.system === system && a.slug === slug);
  const card = system === 'tarot' && entry ? content.cards.find((c) => c.key === entry) : undefined;
  const hexagram =
    system === 'iching' && entry ? content.hexagrams.find((h) => h.key === entry) : undefined;
  const glossary = bundledKnowledge().glossary;
  const term = system === 'glossary' && entry ? glossary.find((g) => g.key === entry) : undefined;
  const overview = !entry && !slug ? content.systems.find((s) => s.key === system) : undefined;
  const invalid = Boolean(system && !overview && !card && !hexagram && !tutorial && !term);
  function link(href: string) {
    router.push(href as `/learn/${string}`);
  }
  const matches = (text: string) =>
    text.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale));
  if (!system) {
    const rows =
      category === 'systems'
        ? content.systems.map((s) => ({
            key: s.key,
            title: s[language].title,
            href: `/learn/${s.key}`,
          }))
        : category === 'cards'
          ? content.cards.map((c) => ({
              key: c.key,
              title: c.name[language],
              href: `/learn/tarot/${c.key}`,
            }))
          : category === 'hexagrams'
            ? content.hexagrams.map((h) => ({
                key: h.key,
                title: language === 'en' ? h.englishName : h.name,
                href: `/learn/iching/${h.key}`,
              }))
            : category === 'tutorials'
              ? content.articles.map((a) => ({
                  key: `${a.system}/${a.slug}`,
                  title: a[language].title,
                  href: `/learn/${a.system}/articles/${a.slug}`,
                }))
              : glossary.map((g) => ({
                  key: g.key,
                  title: g[language].term,
                  href: `/learn/glossary/${g.key}`,
                }));
    const filtered = rows.filter((r) => matches(localeText(r.title, locale)));
    // DESIGN-GAP: The encyclopedia index uses one variable-height FlatList instead of appending unbounded ScrollView rows.
    return (
      <Page title="learn.title" scroll={false}>
        <FlatList
          testID="learn-list"
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(row) => row.key}
          initialNumToRender={12}
          maxToRenderPerBatch={6}
          windowSize={5}
          contentContainerStyle={{ gap: spacing('space-2'), paddingBottom: 24 }}
          ListHeaderComponent={
            <View style={{ gap: spacing('space-3'), marginBottom: 12 }}>
              <CopyText>{t('learn.intro')}</CopyText>
              {categories.map((c) => (
                <Action
                  key={c}
                  id={`learn-category-${c}`}
                  label={t(`learn.${c}`)}
                  selected={category === c}
                  onPress={() => {
                    setCategory(c);
                    setSearch('');
                  }}
                />
              ))}
              <Field
                id="learn-search"
                label={t('mobile.learn.search')}
                value={search}
                onChange={setSearch}
              />
            </View>
          }
          ListEmptyComponent={<CopyText>{t('mobile.learn.empty')}</CopyText>}
          renderItem={({ item, index }) => (
            <Action
              id={`learn-item-${index}`}
              label={prose(item.title)}
              onPress={() => link(item.href)}
            />
          )}
        />
      </Page>
    );
  }
  return (
    <Page title="learn.title">
      {system && (
        <Action id="learn-back" label={t('form.birth.back')} onPress={() => router.back()} />
      )}
      {invalid && <CopyText>{t('report.error.E_NOT_FOUND')}</CopyText>}
      {tutorial && (
        <>
          <CopyText title testID="learn-article-title">
            {prose(tutorial[language].title)}
          </CopyText>
          <CopyText>{prose(tutorial[language].description)}</CopyText>
          {tutorial[language].sections.map((s, i) =>
            block(prose(s.heading), s.paragraphs.join('\n\n'), `learn-section-${i}`),
          )}
          {tutorial.links.map((l) => (
            <Action key={l.href} label={prose(l.label[language])} onPress={() => link(l.href)} />
          ))}
        </>
      )}
      {card && (
        <>
          <CopyText title testID="learn-card-title">
            {prose(card.name[language])}
          </CopyText>
          <CopyText>{prose(card.keywordsUpright[language].join(' · '))}</CopyText>
          <Image
            source={tarotImages[card.key as keyof typeof tarotImages]}
            accessibilityLabel={prose(card.name[language])}
            style={{ width: 180, height: 315, alignSelf: 'center' }}
          />
          {(
            ['meaningUpright', 'meaningReversed', 'imagery', 'historySymbolism', 'advice'] as const
          ).map((k) => block(t(`learn.${k}`), card[k][language]))}
          <CopyText>{prose(card.keywordsReversed[language].join(' · '))}</CopyText>
          <CopyText title>{t('learn.related')}</CopyText>
          {content.cards
            .filter((c) => c.key !== card.key && c.element === card.element)
            .slice(0, 3)
            .map((c) => (
              <Action
                key={c.key}
                label={prose(c.name[language])}
                onPress={() => link(`/learn/tarot/${c.key}`)}
              />
            ))}
          <Action
            id="learn-tarot-cta"
            label={t('learn.drawCTA')}
            onPress={() => router.push('/tarot/reading')}
          />
        </>
      )}
      {hexagram && (
        <>
          <CopyText title>
            {prose(language === 'en' ? hexagram.englishName : hexagram.name)}
          </CopyText>
          <CopyText>{t('learn.hexagramNumber', { number: hexagram.number })}</CopyText>
          <View testID="learn-hexagram" style={{ gap: spacing('space-2'), alignItems: 'center' }}>
            {[...hexagram.lines].reverse().map((line, i) => (
              <View
                key={i}
                style={{
                  width: 160,
                  height: 6,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing('space-4'),
                }}
              >
                {line ? (
                  <View style={{ flex: 1, backgroundColor: colors.gold }} />
                ) : (
                  <>
                    <View style={{ flex: 1, backgroundColor: colors.gold }} />
                    <View style={{ flex: 1, backgroundColor: colors.gold }} />
                  </>
                )}
              </View>
            ))}
          </View>
          {block(t('learn.meaning'), hexagram.meaning[language])}
          {block(t('learn.historySymbolism'), hexagram.historySymbolism[language])}
          <Action
            id="learn-original"
            selected={original}
            label={t('learn.original')}
            onPress={() => setOriginal(!original)}
          />
          {original && (
            <CopyText>
              {prose([hexagram.judgment, hexagram.tuan, hexagram.image].join('\n\n'))}
            </CopyText>
          )}
          <CopyText title>{t('learn.lines')}</CopyText>
          {hexagram.yao.map((y) =>
            block(
              t('learn.lineNumber', { number: y.position }),
              [...(original ? [y.original, y.image] : []), y.meaning[language]].join('\n'),
            ),
          )}
          {Object.entries(hexagram.guidance).map(([k, v]) =>
            block(t(`learn.category.${k}` as 'learn.category.career'), v[language]),
          )}
          <Action label={t('learn.start')} onPress={() => router.push('/iching')} />
        </>
      )}
      {term && (
        <>
          <CopyText title>{prose(term[language].term)}</CopyText>
          {block(prose(term[language].short), term[language].long)}
        </>
      )}
      {overview && (
        <>
          <CopyText title>{prose(overview[language].title)}</CopyText>
          {(['history', 'principle', 'questions', 'school'] as const).map((k) =>
            block(t(`learn.${k}`), overview[language][k]),
          )}
          <CopyText title>{t('learn.faq')}</CopyText>
          {overview[language].faq.map((f) => block(prose(f.question), f.answer))}
          <CopyText title>{t('learn.tutorials')}</CopyText>
          {content.articles
            .filter((a) => a.system === system)
            .map((a) => (
              <Action
                key={a.slug}
                label={prose(a[language].title)}
                onPress={() => link(`/learn/${a.system}/articles/${a.slug}`)}
              />
            ))}
          <Action label={t('learn.start')} onPress={() => router.push('/reading')} />
        </>
      )}
    </Page>
  );
}
