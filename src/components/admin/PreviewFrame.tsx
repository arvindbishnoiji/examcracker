'use client';

import { Segmented } from './ui';

export type PreviewDevice = 'desktop' | 'mobile';

export function PreviewFrame({
  device,
  onDevice,
  children,
  label = 'Live preview',
  hint,
}: {
  device: PreviewDevice;
  onDevice: (next: PreviewDevice) => void;
  children: React.ReactNode;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="ec-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-ink-100">
        <div>
          <p className="text-xs font-bold text-ink-800">{label}</p>
          {hint && <p className="text-[10px] text-ink-500 mt-0.5">{hint}</p>}
        </div>
        <Segmented
          size="sm"
          value={device}
          onChange={onDevice}
          options={[
            { value: 'desktop', label: 'Desktop', icon: '▭' },
            { value: 'mobile', label: 'Mobile', icon: '▯' },
          ]}
        />
      </div>
      <div className="p-3 sm:p-4 bg-ink-50/60">
        <div className={`mx-auto transition-all ${device === 'mobile' ? 'w-[340px] max-w-full' : 'w-full'}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
