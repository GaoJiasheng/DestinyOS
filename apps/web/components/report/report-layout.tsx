'use client';
import { AstroChartSchema, VedicChartSchema, type HouseSystem } from '@tianji/shared';
import { AstrologyReportChart } from '../charts/astrology-report-chart';
import { VedicReportChart } from '../charts/vedic-report-chart';
import { PlanetTable, HouseTable } from '../charts/planet-table';
import { AspectTable } from '../charts/aspect-table';
import { DashaTimeline } from '../charts/dasha-timeline';
import { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ReadingView } from '@/lib/reading-schema';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  previewAstrologyHousesAction,
  getReadingBirthAction,
  deleteReadingAction,
  renameReadingAction,
  regenerateReportAction,
  translateAnonymousReportAction,
} from '@/app/readings/actions';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import { ShareDialog } from '@/components/share/share-dialog';
import { ChatPanel } from './chat-panel';
