import { redirect } from 'next/navigation';

// "All Submissions" just redirects to admin dashboard which has the full table
export default function AllSubmissionsPage() {
  redirect('/dashboard/admin');
}
