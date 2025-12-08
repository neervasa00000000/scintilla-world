import { useState, useEffect, useRef, useCallback } from 'react';

import { Pizza, Heart, Zap, Moon, Sword, User, LogOut, Search, Sun, Star, Copy, Check } from 'lucide-react';

// --- FIREBASE IMPORTS ---

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";

import { 

  getAuth, signInWithCustomToken, signInAnonymously, GoogleAuthProvider, 

  signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, Auth

} from "firebase/auth";

import { 

  getFirestore, doc, setDoc, getDoc, onSnapshot, collection, query, limit, Firestore

} from "firebase/firestore";

// --- 1. ROBUST INITIALIZATION ---

let app: FirebaseApp | null = null;

let auth: Auth | null = null;

let db: Firestore | null = null;

try {

  // @ts-ignore

  const rawConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';

  const config = JSON.parse(rawConfig);

  if (config && config.apiKey) {

    app = !getApps().length ? initializeApp(config) : getApp();

    auth = getAuth(app);

    db = getFirestore(app);

  } else { console.warn("Offline Mode Active"); }

} catch (e: any) { 

  console.error("Init Error:", e);

}

// @ts-ignore

const appId = typeof __app_id !== 'undefined' ? __app_id : 'pixel-panda-v2';

// --- TYPES ---

type PandaAction = 'idle' | 'walking' | 'eating' | 'sleeping' | 'happy' | 'fighting' | 'levelup';

type Direction = 'left' | 'right';

interface PlayerData {

  uid: string;

  name: string;

  pet: {

    x: number; y: number;

    action: PandaAction;

    direction: Direction;

    walkFrame: number;

    level: number;

  };

  lastUpdated: number;

}

interface Particle {

  id: number; x: number; y: number; vx: number; vy: number; life: number;

  type: 'heart' | 'star' | 'zzz' | 'crumb' | 'levelup'; color: string; char: string;

}

// --- VISUAL COMPONENTS ---
// PremiumPixelPanda component removed - not used in popup (only content script uses panda)

const StatBar = ({ icon: Icon, value, color, max = 100, label }: { icon: any, value: number, color: string, max?: number, label?: string }) => (

  <div>

    {label && <div className="text-[9px] uppercase font-bold text-slate-400 mb-0.5 ml-6">{label}</div>}

    <div className="flex items-center gap-2 w-full">

      <Icon size={12} className="text-slate-400" />

      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-100 relative group">

        <div 

          className={`h-full ${color} transition-all duration-500 ease-out`} 

          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}

        />

        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">

           {Math.floor(value)} / {Math.floor(max)}

        </div>

      </div>

    </div>

  </div>

);

// --- MAIN APPLICATION ---

export default function PandaApp() {

  const [user, setUser] = useState<FirebaseUser | any>(null);

  const [isOffline, setIsOffline] = useState(false);

  const [activeTab, setActiveTab] = useState<'care' | 'social'>('care');

  const [stats, setStats] = useState({ hunger: 60, happiness: 50, energy: 40 });

  const [copied, setCopied] = useState(false);

  

  // LEVELING STATE

  const [level, setLevel] = useState(1);

  const [xp, setXp] = useState(0);

  const [maxXp, setMaxXp] = useState(100);

  const [attackPower, setAttackPower] = useState(5);

  const pandaRef = useRef<HTMLDivElement>(null);

  const posRef = useRef({ x: 50, y: 50 });

  const targetRef = useRef({ x: 50, y: 50 });

  const actionRef = useRef<PandaAction>('idle');

  const dirRef = useRef<Direction>('right');

  const frameRef = useRef(0);

  

  const [_, setTick] = useState(0); 

  const [isPopupOpen, setIsPopupOpen] = useState(true);

  const [connectId, setConnectId] = useState('');

  const [players, setPlayers] = useState<PlayerData[]>([]);

  const particlesRef = useRef<Particle[]>([]);

  // 1. Difficulty

  const calculateNextLevelXp = (lvl: number) => Math.floor(100 * Math.pow(1.5, lvl - 1));

  // 2. XP Logic

  const handleGainXp = (amount: number) => {

    let newXp = xp + amount;

    if (newXp >= maxXp) {

      const nextLevel = level + 1;

      const leftoverXp = newXp - maxXp;

      const nextMax = calculateNextLevelXp(nextLevel);

      setLevel(nextLevel);

      setXp(leftoverXp);

      setMaxXp(nextMax);

      setAttackPower(5 + (nextLevel * 2));

      actionRef.current = 'levelup';

      spawnParticles('levelup', 15, posRef.current.x, posRef.current.y);

      setTimeout(() => actionRef.current = 'idle', 3000);

    } else {

      setXp(newXp);

    }

  };

  const spawnParticles = useCallback((type: Particle['type'], count: number, x: number, y: number) => {

    const colors = { heart: '#ec4899', star: '#eab308', zzz: '#94a3b8', crumb: '#f59e0b', levelup: '#8b5cf6' };

    const chars = { heart: '♥', star: '★', zzz: 'z', crumb: '•', levelup: '⬆' };

    for(let i=0; i<count; i++) {

      particlesRef.current.push({

        id: Math.random(), x, y, 

        vx: (Math.random()-0.5)*(type==='levelup'?1.5:0.5), 

        vy: type==='levelup' ? -Math.random()*2 : -Math.random()*0.5, 

        life: 1.0, type, color: colors[type], char: chars[type]

      });

    }

  }, []);

  // 3. Auth

  useEffect(() => {

    if (!auth) {

      setIsOffline(true);

      setUser({ uid: 'offline-panda', displayName: 'Guest', isAnonymous: true });

      return;

    }

    const initAuth = async () => {

        try {

          // @ts-ignore

          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);

          else await signInAnonymously(auth!);

        } catch (e) {

          console.warn("Auth Failed", e);

          setIsOffline(true);

          setUser({ uid: 'offline-panda', displayName: 'Guest', isAnonymous: true });

        }

    };

    initAuth();

    if (auth) return onAuthStateChanged(auth, u => setUser(u));

  }, []);

  const handleLogin = async () => {

    if (isOffline) { alert("Offline"); return; }

    try {

      const provider = new GoogleAuthProvider();

      await signInWithPopup(auth!, provider);

    } catch (e) { console.error(e); }

  };

  const copyId = () => {

    if (user?.uid) {

      navigator.clipboard.writeText(user.uid);

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);

    }

  };

  // 4. Multiplayer Search

  const searchForPlayer = async () => {

    if (isOffline || !db || !connectId) { alert("Offline"); return; }

    try {

      const docRef = doc(db, 'artifacts', appId, 'public', 'players', connectId);

      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {

        const p = docSnap.data() as PlayerData;

        if (!players.find(pl => pl.uid === p.uid)) setPlayers(prev => [p, ...prev]);

        spawnParticles('star', 10, 50, 50); 

      } else { alert("Not found"); }

    } catch (e) { console.error(e); }

  };

  useEffect(() => {

    if (isOffline || !user || !db) return;

    try {

      const q = query(collection(db, 'artifacts', appId, 'public', 'players'), limit(20));

      return onSnapshot(q, (snap) => {

        const active: PlayerData[] = [];

        const now = Date.now();

        snap.forEach(d => {

          if (d.id === user.uid) return;

          const p = d.data() as PlayerData;

          if (now - p.lastUpdated < 60000) active.push(p);

        });

        setPlayers(active);

      });

    } catch (e) { setIsOffline(true); }

  }, [user, isOffline]);

  // 5. Sync

  useEffect(() => {

    if (isOffline || !user || !db) return;

    const interval = setInterval(() => {

        try {

          if (db && user) {

            setDoc(doc(db, 'artifacts', appId, 'public', 'players', user.uid), {

              uid: user.uid, name: user.displayName || 'Guest',

              pet: {

                x: posRef.current.x, y: posRef.current.y,

                action: actionRef.current, direction: dirRef.current,

                walkFrame: frameRef.current, level: level 

              },

              lastUpdated: Date.now()

            }, { merge: true });

          }

        } catch (e) {}

    }, 1000);

    return () => clearInterval(interval);

  }, [user, level, isOffline]);

  // 6. GAME LOOP (The Fix)

  useEffect(() => {

    let lastTime = performance.now();

    let animId: number;

    const loop = (time: number) => {

      const dt = Math.min((time - lastTime) / 1000, 0.1);

      lastTime = time;

      setStats(prev => {

        const isSleeping = actionRef.current === 'sleeping';

        return {

          hunger: Math.max(0, prev.hunger - (dt * 0.5)),

          happiness: Math.max(0, prev.happiness - (dt * 0.3)), 

          energy: isSleeping ? Math.min(100, prev.energy + (dt * 5)) : Math.max(0, prev.energy - (dt * 0.2)) 

        };

      });

      const p = posRef.current;

      const t = targetRef.current;

      

      if (actionRef.current === 'walking') {

        const dx = t.x - p.x;

        const dy = t.y - p.y;

        const dist = Math.sqrt(dx*dx + dy*dy);

        

        if (dist < 1) {

          actionRef.current = 'idle';

          p.x = t.x; p.y = t.y;

        } else {

          const speed = 25 * dt; 

          p.x += (dx/dist) * speed;

          p.y += (dy/dist) * speed;

          dirRef.current = dx > 0 ? 'right' : 'left';

          frameRef.current += 10 * dt;

        }

      } else if (actionRef.current === 'idle') {

        if (Math.random() < 0.02) { 

          t.x = 5 + Math.random() * 90;

          t.y = 5 + Math.random() * 90;

          actionRef.current = 'walking';

        }

      }

      if (pandaRef.current) {

        pandaRef.current.style.left = `${p.x}%`;

        pandaRef.current.style.top = `${p.y}%`;

      }

      particlesRef.current = particlesRef.current.map(pt => ({

        ...pt, x: pt.x + pt.vx, y: pt.y + pt.vy, life: pt.life - dt

      })).filter(pt => pt.life > 0);

      setTick(prev => prev + 1); 

      animId = requestAnimationFrame(loop);

    };

    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);

  }, [spawnParticles]);

  const actions = {

    feed: () => {

      if (stats.hunger >= 100 || actionRef.current === 'sleeping') return;

      actionRef.current = 'eating';

      setStats(s => ({ ...s, hunger: Math.min(100, s.hunger + 30) }));

      handleGainXp(15);

      spawnParticles('crumb', 8, posRef.current.x, posRef.current.y);

      setTimeout(() => actionRef.current = 'idle', 2000);

    },

    love: () => {

      if (actionRef.current === 'sleeping') return;

      actionRef.current = 'happy';

      setStats(s => ({ ...s, happiness: Math.min(100, s.happiness + 25) }));

      handleGainXp(25); 

      spawnParticles('heart', 5, posRef.current.x, posRef.current.y);

      setTimeout(() => actionRef.current = 'idle', 2000);

    },

    sleep: () => {

      actionRef.current = actionRef.current === 'sleeping' ? 'idle' : 'sleeping';

    }

  };

  return (

    <div className="relative w-full h-full bg-white font-sans text-slate-800 select-none flex flex-col">

      {/* UI - Only show the game interface panel */}
      {isPopupOpen ? (

        <div className="w-full h-full bg-white overflow-hidden flex flex-col">

          <div className="px-3 py-2 bg-slate-900 text-white flex justify-between items-center">

            <div className="flex items-center gap-2">

              <div className="bg-emerald-500 p-1 rounded-lg"><Zap size={14} className="text-white fill-current" /></div>

              <div>

                 <h1 className="text-sm font-bold tracking-tight">PixelPet<span className="text-emerald-400">.ext</span></h1>

                 <div className="text-[10px] text-slate-400 flex gap-2 items-center">

                   <span className="text-yellow-400 font-bold">Lvl {level}</span>

                   <span>• {xp}/{maxXp} XP</span>

                 </div>

              </div>

            </div>

            {/* Close button removed - popup should always show UI */}

          </div>

          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 space-y-1.5">

            <StatBar icon={Pizza} value={stats.hunger} color="bg-amber-500" label="Hunger" />

            <StatBar icon={Heart} value={stats.happiness} color="bg-pink-500" label="Happiness" />

            <StatBar icon={Star} value={xp} max={maxXp} color="bg-purple-500" label="XP Progress" />

            <div className="flex justify-between items-center mt-2 px-1">

               <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Sword size={10}/> Power: {attackPower}</span>

            </div>

          </div>

          <div className="flex border-b border-slate-100">

            <button onClick={() => setActiveTab('care')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider ${activeTab==='care' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}>Care</button>

            <button onClick={() => setActiveTab('social')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider ${activeTab==='social' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-400 hover:bg-slate-50'}`}>Social</button>

          </div>

          <div className="p-3 min-h-[120px]">

             {activeTab === 'care' ? (

                <div className="grid grid-cols-2 gap-2">

                   <button onClick={actions.feed} disabled={actionRef.current === 'sleeping'} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 hover:scale-[1.02] transition border border-amber-100 disabled:opacity-50">

                      <Pizza size={18} /> <span className="font-bold text-[10px]">Feed (+15XP)</span>

                   </button>

                   <button onClick={actions.love} disabled={actionRef.current === 'sleeping'} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-100 hover:scale-[1.02] transition border border-pink-100 disabled:opacity-50">

                      <Heart size={18} /> <span className="font-bold text-[10px]">Pet (+25XP)</span>

                   </button>

                  <button onClick={actions.sleep} className={`col-span-2 flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition border ${actionRef.current === 'sleeping' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100'}`}>

                    {actionRef.current === 'sleeping' ? <Sun size={18}/> : <Moon size={18}/>}

                    <span className="font-bold text-[10px]">{actionRef.current === 'sleeping' ? 'Wake Up' : 'Sleep Mode'}</span>

                   </button>

                </div>

             ) : (

                <div className="space-y-4">

                   <div className="flex gap-2">

                      <div className="relative flex-1">

                         <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />

                         <input 

                           value={connectId} onChange={(e) => setConnectId(e.target.value)}

                           placeholder="Enter Player ID..." 

                           className="w-full pl-8 pr-3 py-2 bg-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 transition"

                         />

                      </div>

                      <button onClick={searchForPlayer} className="bg-emerald-500 text-white px-3 rounded-lg font-bold text-xs hover:bg-emerald-600">Add</button>

                   </div>

                   

                   <div className="space-y-2">

                      <div className="text-[10px] font-bold text-slate-400 uppercase">Visible Players</div>

                      {isOffline ? (

                        <div className="text-center py-4 text-xs text-red-400 italic bg-red-50 rounded border border-red-100">

                           Social features disabled (Offline Mode)

                        </div>

                      ) : players.length === 0 ? (

                         <div className="text-center py-4 text-xs text-slate-400 italic">No one is nearby...</div>

                      ) : (

                         players.map(p => (

                            <div key={p.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition group">

                                <div className="flex items-center gap-2">

                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">{p.name[0]}</div>

                                    <div>

                                      <div className="text-xs font-medium">{p.name}</div>

                                      <div className="text-[8px] text-slate-400 font-mono">ID: {p.uid.slice(0,6)}...</div>

                                    </div>

                                </div>

                                <div className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1 rounded">Lv {p.pet.level}</div>

                            </div>

                         ))

                      )}

                   </div>

                </div>

             )}

          </div>

          

          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400">

             <div onClick={copyId} className="flex items-center gap-1 cursor-pointer hover:text-slate-600" title="Click to copy ID">

                <span>UID: {user?.uid.slice(0,8)}...</span>

                {copied ? <Check size={10} className="text-green-500"/> : <Copy size={10}/>}

             </div>

             

             {!isOffline && user?.isAnonymous && (

                <button onClick={handleLogin} className="text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1">Connect <User size={10}/></button>

             )}

             

             {!isOffline && !user?.isAnonymous && (

                <button onClick={() => auth && signOut(auth)} className="hover:text-red-500 flex items-center gap-1"><LogOut size={10}/> Logout</button>

             )}

          </div>

        </div>

      ) : (

        <button onClick={() => setIsPopupOpen(true)} className="absolute top-6 right-6 w-14 h-14 bg-slate-900 rounded-2xl shadow-xl flex items-center justify-center text-white hover:scale-110 transition z-50">

          <Zap size={24} fill="currentColor" className="text-yellow-400" />

        </button>

      )}

      <style>{`

        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }

      `}</style>

    </div>

  );

}

