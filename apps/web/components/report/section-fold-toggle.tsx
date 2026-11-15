'use client';
import { useEffect, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { readFoldPreference, writeFoldPreference } from './report-utils';

function applyFolds(open: boolean) {
  document.querySelectorAll<HTMLDetailsElement>('details.section-fold').forEach((fold) => {
    fold.open = open;
  });
}

/** Expand or collapse every report section; the choice carries across reports for this session.
 * Individual sections stay independently toggleable, and printing still opens every section. */
export function SectionFoldToggle() {
  const t = useCopy();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    // Read after hydration so server and client markup agree.
    if (readFoldPreference() !== 'open') return;
    setExpanded(true);
    applyFolds(true);
  }, []);
  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    applyFolds(next);
    writeFoldPreference(next ? 'open' : 'closed');
  };
  const Icon = expanded ? ChevronsDownUp : ChevronsUpDown;
  return (
    <div className="section-fold-toggle">
      <Button variant="secondary" type="button" onClick={toggle}>
        <Icon aria-hidden="true" size={16} />
        {t(expanded ? 'report.folds.collapseAll' : 'report.folds.expandAll')}
      </Button>
    </div>
  );
}
