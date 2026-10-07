import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '../../../components/report/chat-screen';
/** Native report follow-up route matching the App navigation contract. */
export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatScreen id={id} />;
}
