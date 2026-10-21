import { redirect } from 'next/navigation';

export default function LegacyChatRedirect() {
  redirect('/feedback');
}
