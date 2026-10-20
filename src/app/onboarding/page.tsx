'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { saveStudentProfile } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';

export default function OnboardingPage(){
  const { user, profile, initializing, refresh } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [exam, setExam] = useState<'JEE'|'NEET'>('JEE');
  const [classLevel, setClassLevel] = useState<'11'|'12'>('11');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(()=>{
    if(initializing) return;
    if(!user) router.replace('/login');
    else if(profile) router.replace('/home');
    else if(user.displayName) setDisplayName(user.displayName);
  },[user, profile, initializing, router]);

  async function handleSubmit(e: React.FormEvent){
    e.preventDefault();
    setError(null);
    if(displayName.trim().length < 2){ setError('Name must be 2-80 characters.'); return; }
    if(!['JEE','NEET'].includes(exam) || !['11','12'].includes(classLevel)){ setError('Choose JEE/NEET and Class 11 or 12'); return; }
    setLoading(true);
    try{
      await saveStudentProfile({ displayName: displayName.trim(), exam, classLevel });
      push('Profile saved — welcome to Exam Cracker!','success');
      await refresh();
      router.replace('/home');
    }catch(err){
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally { setLoading(false); }
  }

  if(initializing) return <div className="max-w-xl mx-auto mt-10 text-sm text-ink-500">Loading…</div>;

  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-ink-900">Complete your profile</h1>
            <p className="text-sm text-ink-500 mt-1">One-time setup. We use this to show only the lectures, tests and batches relevant to your exam.</p>
          </div>

          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="Display name" placeholder="Your full name" value={displayName} onChange={e=>setDisplayName(e.target.value)} required />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Exam" value={exam} onChange={e=>setExam(e.target.value as 'JEE'|'NEET')}>
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
              </Select>
              <Select label="Class" value={classLevel} onChange={e=>setClassLevel(e.target.value as '11'|'12')}>
                <option value="11">Class 11th</option>
                <option value="12">Class 12th</option>
              </Select>
            </div>

            <div className="p-4 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-800">
              <p className="font-semibold">Why we ask?</p>
              <p className="text-xs mt-1">Your Home, Batches, Lectures and Tests are filtered by this selection. You can update it later from Profile if needed (via API).</p>
            </div>

            <Button type="submit" loading={loading} className="w-full">Save and continue</Button>
            <p className="text-xs text-center text-ink-400">Saved via POST /profile with Firebase ID token + Supabase publishable key. No anonymous access.</p>
          </form>
        </div>
      </Card>
    </div>
  );
}
