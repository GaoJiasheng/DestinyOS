import { Redirect } from 'expo-router';
import { membershipEnabled } from '../../lib/monetization/features';
import { BillingScreen } from '../../components/billing-screen';
/** Disabled purchase deep links return to the account tab. */
export default function MembershipRoute() {
  return membershipEnabled() ? <BillingScreen /> : <Redirect href="/me" />;
}
