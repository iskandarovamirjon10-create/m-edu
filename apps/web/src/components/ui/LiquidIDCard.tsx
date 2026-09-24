import { useState} from'react';
import { GlassSurface} from'./Glass';

export interface LiquidIDCardProps {
 name: string;
 role: string;
 id: string;
 photo?: string;
 initials?: string;
 department?: string;
 status?:'active' |'inactive' |'pending';
}

/** Liquid Glass Student/Teacher/Staff ID Card */
export default function LiquidIDCard({
 name, role, id, photo, initials, department, status ='active',
}: LiquidIDCardProps) {
 const [hover, setHover] = useState(false);
 const statusColor = status ==='active' ?'bg-[var(--state-success)]' : status ==='pending' ?'bg-[var(--state-warning)]' :'bg-[var(--state-error)]';

 return (
 <GlassSurface
 elevation="high"
 tone="light"
 tilt
 onMouseEnter={() => setHover(true)}
 onMouseLeave={() => setHover(false)}
 className="min-w-[260px] max-w-[320px] p-6 text-[var(--text-primary)] relative"
 >
 {/* Status pill */}
 <div className="absolute top-4 right-4 flex items-center gap-1.5">
 <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
 <span className="text-[11px] font-medium text-[var(--text-muted)] capitalize">{status}</span>
 </div>

 {/* Avatar */}
 <div className="relative">
 <div
 className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg ring-2 ring-[rgba(255,255,255,0.5)] mx-auto mb-4 transition-transform duration-300"
 style={{ transform: hover ?'translateY(-2px) scale(1.03)' :'none'}}
 >
 {photo ? (
 <img src={photo} alt={name} className="w-full h-full object-cover"/>
 ) : (
 <div className="w-full h-full bg-gradient-to-br from-[var(--m-azure)] to-[var(--m-vivid)] flex items-center justify-center text-white text-2xl font-bold">
 {initials || name.split('').map(n => n[0]).join('').slice(0, 2)}
 </div>
 )}
 </div>
 {/* Dynamic reflection */}
 <div
 aria-hidden
 className="absolute -top-2 -right-4 h-10 w-28 rounded-full bg-gradient-to-r from-white/20 to-transparent blur-xl pointer-events-none"
 style={{ opacity: hover ? 0.7 : 0.3, transition:'opacity 0.35s ease'}}
 />
 </div>

 <div className="text-center space-y-1">
 <h3 className="text-lg font-bold tracking-tight leading-tight text-[var(--text-primary)]">{name}</h3>
 <p className="text-sm font-medium text-[var(--m-vivid)]">{role}</p>
 {department && <p className="text-xs text-[var(--text-muted)]">{department}</p>}
 <div className="pt-3 border-t border-[var(--border-subtle)] mt-3">
 <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wide">ID — {id}</span>
 </div>
 </div>
 </GlassSurface>
 );
}
