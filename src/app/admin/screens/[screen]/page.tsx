'use client';

import { useParams } from 'next/navigation';
import { ScreenEditor } from '@/components/admin/screens/ScreenEditor';

export default function AdminScreenEditorPage() {
  const params = useParams<{ screen: string }>();
  const slug = typeof params?.screen === 'string' ? params.screen : '';
  return <ScreenEditor slug={slug} />;
}
