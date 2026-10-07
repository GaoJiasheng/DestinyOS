import { Redirect } from 'expo-router';
/** Browser auth owns callback validation; direct navigation returns to the login surface. */
export default function Callback() {
  return <Redirect href="/auth/login" />;
}
