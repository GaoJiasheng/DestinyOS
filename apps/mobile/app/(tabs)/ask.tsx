import { useRouter } from 'expo-router';
import { AskSheet } from '../../components/ask-sheet';
/** Direct ask deep links present the same central native sheet as the tab button. */
export default function AskRoute() {
  const router = useRouter();
  return <AskSheet open onClose={() => router.replace('/today')} />;
}
