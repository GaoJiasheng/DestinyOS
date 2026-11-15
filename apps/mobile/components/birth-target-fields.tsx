import { View } from 'react-native';
import { useCopy } from '../lib/copy';
import type { Profile } from '../lib/data/models';
import { Action, CopyText } from './native-ui';
export type Relation = NonNullable<Profile['relation']>;
export type BirthTarget = 'self' | 'other';
const others = ['partner', 'family', 'friend', 'other'] as const;
/** "Who is this for" decides whether saving switches the active profile; "someone else" then picks the relation. */
export function BirthTargetFields({
  target,
  relation,
  onChange,
}: {
  target: BirthTarget;
  relation: Relation;
  onChange: (target: BirthTarget, relation: Relation) => void;
}) {
  const t = useCopy();
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup">
      <CopyText>{t('form.birth.for.legend')}</CopyText>
      <Action
        id="birth-for-self"
        label={t('mobile.birth.for.self')}
        selected={target === 'self'}
        onPress={() => onChange('self', 'self')}
      />
      <Action
        id="birth-for-other"
        label={t('mobile.birth.for.other')}
        selected={target === 'other'}
        onPress={() => onChange('other', relation === 'self' ? 'partner' : relation)}
      />
      {target === 'other' && (
        <>
          <CopyText>{t('profiles.relation')}</CopyText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {others.map((item) => (
              <Action
                key={item}
                id={`profile-relation-${item}`}
                label={t(`profiles.relation.${item}`)}
                selected={relation === item}
                onPress={() => onChange('other', item)}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}
