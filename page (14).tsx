import { redirect } from 'next/navigation';

export default async function Home() {
  // Login is bypassed in testing mode — go straight to the dashboard.
  redirect('/dashboard');
}
