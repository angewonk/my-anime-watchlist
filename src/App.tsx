import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocFromServer,
  serverTimestamp
} from 'firebase/firestore';
import {
  Plus,
  Minus,
  Trash2,
  BookOpen,
  Search,
  Star,
  LogOut,
  X,
  Loader2,
  Sparkles,
  Clock,
  ExternalLink,
  ChevronRight,
  Heart,
  Film,
  Tv,
  HelpCircle
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

// Model definition mapping exactly to firebase-blueprint.json
interface AnimeTrack {
  id: string; // Document ID: `${userId}_${animeId}`
  userId: string;
  animeId: string;
  title: string;
  imageUrl: string;
  animeType: string;
  episodesCount: number;
  episodesWatched: number;
  status: 'watching' | 'completed' | 'planning' | 'dropped' | 'on_hold';
  score: number; // 0 to 10
  notes: string;
  createdAt: any;
  updatedAt: any;
}

// 9 Curated Cozy & Classic Masterpieces for swift click-and-add
interface CuratedClassic {
  animeId: string;
  title: string;
  imageUrl: string;
  animeType: string;
  episodesCount: number;
  description: string;
  year: number;
}

const CURATED_CLASSICS: CuratedClassic[] = [
  {
    animeId: "199",
    title: "Spirited Away",
    imageUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=60", // dynamic backup/placeholder
    animeType: "Movie",
    episodesCount: 1,
    description: "Chihiro wanders into an enchanted bathhouse world governed by spirits, gods, and a sorceress.",
    year: 2001
  },
  {
    animeId: "523",
    title: "My Neighbor Totoro",
    imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=60",
    animeType: "Movie",
    episodesCount: 1,
    description: "Two young sisters explore the countryside and befriend magical forest spirits, including a giant gentle protector.",
    year: 1988
  },
  {
    animeId: "431",
    title: "Howl's Moving Castle",
    imageUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&auto=format&fit=crop&q=60",
    animeType: "Movie",
    episodesCount: 1,
    description: "Cursed with an old body by a spiteful witch, young Sophie finds sanctuary inside a wizard's walking castle.",
    year: 2004
  },
  {
    animeId: "164",
    title: "Princess Mononoke",
    imageUrl: "https://images.unsplash.com/photo-1500622486096-9f150024724c?w=400&auto=format&fit=crop&q=60",
    animeType: "Movie",
    episodesCount: 1,
    description: "An Ashitaka prince is embattled in a war between the greedy human industrialists and the ancient gods of the wild wood.",
    year: 1997
  },
  {
    animeId: "512",
    title: "Kiki's Delivery Service",
    imageUrl: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&auto=format&fit=crop&q=60",
    animeType: "Movie",
    episodesCount: 1,
    description: "A resourceful teenage witch leaves her family to establish an independent parcel flying courier service by the coast.",
    year: 1989
  },
  {
    animeId: "513",
    title: "Castle in the Sky",
    imageUrl: "https://images.unsplash.com/photo-1496715976403-7e36dc43f17b?w=400&auto=format&fit=crop&q=60",
    animeType: "Movie",
    episodesCount: 1,
    description: "A farmboy and an orphan girl carrying a crystal amulet race air pirates and military spies to locate Laputa.",
    year: 1986
  },
  {
    animeId: "597",
    title: "Ponyo",
    imageUrl: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=400&auto=format&fit=crop&q=60",
    animeType: "Movie",
    episodesCount: 1,
    description: "A charming goldfish princess flees her deep-sea wizard father to live with a young human boy, tilting the seas.",
    year: 2008
  },
  {
    animeId: "1829",
    title: "The Secret World of Arrietty",
    imageUrl: "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=400&auto=format&fit=crop&q=60",
    animeType: "Movie",
    episodesCount: 1,
    description: "Fourteen-year-old Arrietty and her family are tiny miniature people who survive by borrowing simple items from humans.",
    year: 2010
  },
  {
    animeId: "585",
    title: "Whisper of the Heart",
    imageUrl: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=400&auto=format&fit=crop&q=60",
    animeType: "Movie",
    episodesCount: 1,
    description: "A whimsical coming-of-age romance between a passionate bookworm and a boy who dreams of crafting professional violins.",
    year: 1995
  }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [tracks, setTracks] = useState<AnimeTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState<boolean>(false);

  // Connection validation state
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  // Dynamic trending/popular anime states
  const [popularAnimes, setPopularAnimes] = useState<any[]>([]);
  const [loadingPopular, setLoadingPopular] = useState<boolean>(false);
  const [popularError, setPopularError] = useState<string | null>(null);

  // Search anime flow
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Tab views
  const [activeTab, setActiveTab] = useState<'curated' | 'search'>('curated');

  // Load trending/popular airing anime on load
  useEffect(() => {
    let active = true;
    async function fetchPopular() {
      setLoadingPopular(true);
      setPopularError(null);
      try {
        const resp = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=12');
        if (!resp.ok) {
          throw new Error('Jikan server was unable to retrieve airing lists.');
        }
        const json = await resp.json();
        if (active && json && json.data) {
          setPopularAnimes(json.data);
        }
      } catch (err: any) {
        console.error("Error loading top airing anime: ", err);
        if (active) {
          setPopularError("Notice: Jikan API rates/limits are busy. Please use the Search MAL tab to find and track any anime!");
        }
      } finally {
        if (active) {
          setLoadingPopular(false);
        }
      }
    }
    fetchPopular();
    return () => {
      active = false;
    };
  }, []);

  // Interactive filters
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'watching' | 'completed' | 'planning' | 'dropped' | 'on_hold'>('all');

  // Journal details editor modal
  const [editingTrack, setEditingTrack] = useState<AnimeTrack | null>(null);
  const [journalNotes, setJournalNotes] = useState<string>('');
  const [journalScore, setJournalScore] = useState<number>(0);
  const [journalEpWatched, setJournalEpWatched] = useState<number>(0);
  const [journalStatus, setJournalStatus] = useState<'watching' | 'completed' | 'planning' | 'dropped' | 'on_hold'>('watching');
  const [savingJournal, setSavingJournal] = useState<boolean>(false);

  // Feedback notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Live cozy clock
  const [currentTime, setCurrentTime] = useState<string>(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');

  // Fetch current UTC time periodic updates
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const str = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      setCurrentTime(str);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Show dynamic banner notifications
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // Test connection to Firestore upon initialization
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setConnectionOk(true);
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration or network.");
          setConnectionOk(false);
        } else {
          // If the document is simply missing or access is denied (expected default-deny behavior for random collection paths),
          // it means Firestore server is reachable!
          setConnectionOk(true);
        }
      }
    }
    testConnection();
  }, []);

  // Monitor Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      if (!currentUser) {
        setTracks([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Bind full-screen Firestore synchronizer for user tracks
  useEffect(() => {
    if (!user) return;

    setLoadingTracks(true);
    const path = 'animeTracks';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTracks: AnimeTrack[] = [];
        snapshot.forEach((docSnap) => {
          fetchedTracks.push({
            id: docSnap.id,
            ...docSnap.data()
          } as AnimeTrack);
        });
        
        // Sort by updatedAt descending, fallback to createdAt
        fetchedTracks.sort((a, b) => {
          const tA = a.updatedAt?.seconds || 0;
          const tB = b.updatedAt?.seconds || 0;
          return tB - tA;
        });

        setTracks(fetchedTracks);
        setLoadingTracks(false);
      },
      (error) => {
        setLoadingTracks(false);
        showNotification("Failed to coordinate tracks with forest database.", "error");
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Handle Google Auth with Dialog
  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Configure auth provider options if needed
      await signInWithPopup(auth, provider);
      showNotification("Welcome back to the magic forest tracker!", "success");
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || "Could not log into Google.", "error");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showNotification("Farewell! May the forest winds guide you.", "info");
    } catch (e: any) {
      showNotification("Could not complete logout.", "error");
    }
  };

  // Perform live search query to Jikan API
  const triggerSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const resp = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchQuery)}&limit=12`);
      if (resp.status === 429) {
        throw new Error("The API is whisper-quiet right now (rate-limited). Please wait a moment and search again!");
      }
      if (!resp.ok) {
        throw new Error("Soot sprites lost the trace. Jikan service error occurred.");
      }
      const json = await resp.json();
      if (json && json.data) {
        setSearchResults(json.data);
      } else {
        setSearchResults([]);
      }
    } catch (err: any) {
      setSearchError(err.message || "Search failed.");
      showNotification(err.message || "Failed to search anime.", "error");
    } finally {
      setSearching(false);
    }
  };

  // Quick-add or configure existing tracked anime
  const handleTrackAnime = async (anime: {
    animeId: string;
    title: string;
    imageUrl: string;
    animeType: string;
    episodesCount: number;
    initialStatus?: 'watching' | 'completed' | 'planning' | 'dropped' | 'on_hold';
  }) => {
    if (!user) {
      showNotification("Please pass through the portal and sign in first!", "info");
      return;
    }

    const docId = `${user.uid}_${anime.animeId}`;
    const alreadyTracked = tracks.find(t => t.id === docId);

    if (alreadyTracked) {
      showNotification(`"${anime.title}" is already resting in your forest journal!`, "info");
      setEditingTrack(alreadyTracked);
      setJournalNotes(alreadyTracked.notes || '');
      setJournalScore(alreadyTracked.score || 0);
      setJournalEpWatched(alreadyTracked.episodesWatched || 0);
      setJournalStatus(alreadyTracked.status || 'watching');
      return;
    }

    const path = `animeTracks`;
    // Formulate a beautiful, compliant new entry
    const newTrack: Omit<AnimeTrack, 'id'> = {
      userId: user.uid,
      animeId: anime.animeId,
      title: anime.title,
      imageUrl: anime.imageUrl,
      animeType: anime.animeType || 'TV',
      episodesCount: anime.episodesCount || 1,
      episodesWatched: anime.initialStatus === 'completed' ? (anime.episodesCount || 1) : 0,
      status: anime.initialStatus || 'planning',
      score: 0,
      notes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, path, docId), newTrack);
      showNotification(`Added "${anime.title}" to your forest journal!`, "success");
    } catch (error) {
      showNotification("Could not write track entry to database.", "error");
      handleFirestoreError(error, OperationType.CREATE, `${path}/${docId}`);
    }
  };

  // Safe increment watch episode count
  const handleIncrementEpisode = async (track: AnimeTrack, inc: number) => {
    const nextWatched = Math.max(0, Math.min(track.episodesCount, track.episodesWatched + inc));
    if (nextWatched === track.episodesWatched) return;

    const docId = track.id;
    const path = `animeTracks`;

    // Automatically set status to completed if they reach the exact limit
    let status = track.status;
    if (nextWatched === track.episodesCount && track.episodesCount > 0) {
      status = 'completed';
    } else if (nextWatched > 0 && track.status === 'planning') {
      status = 'watching';
    }

    try {
      await updateDoc(doc(db, path, docId), {
        episodesWatched: nextWatched,
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      showNotification("Failed to update watched episodes.", "error");
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${docId}`);
    }
  };

  // Safe save journaling notes and rating score
  const handleSaveJournalDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTrack) return;

    setSavingJournal(true);
    const docId = editingTrack.id;
    const path = `animeTracks`;

    // Strictly validate inputs before saving
    const cleanNotes = journalNotes.slice(0, 5000);
    const cleanScore = Math.min(10, Math.max(0, journalScore));
    const cleanEp = Math.min(editingTrack.episodesCount, Math.max(0, journalEpWatched));

    try {
      await updateDoc(doc(db, path, docId), {
        notes: cleanNotes,
        score: cleanScore,
        episodesWatched: cleanEp,
        status: journalStatus,
        updatedAt: serverTimestamp()
      });
      showNotification(`Updated journal record for "${editingTrack.title}"`, "success");
      setEditingTrack(null);
    } catch (error) {
      showNotification("Failed to save entries to the parchment database.", "error");
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${docId}`);
    } finally {
      setSavingJournal(false);
    }
  };

  // Remove element safely
  const handleDeleteTrack = async (track: AnimeTrack) => {
    if (!window.confirm(`Are you sure you want to let "${track.title}" drift away from your journal?`)) {
      return;
    }

    const docId = track.id;
    const path = `animeTracks`;

    try {
      await deleteDoc(doc(db, path, docId));
      showNotification(`"${track.title}" has departed peacefully.`, "info");
      if (editingTrack?.id === docId) {
        setEditingTrack(null);
      }
    } catch (error) {
      showNotification("Could not delete the record.", "error");
      handleFirestoreError(error, OperationType.DELETE, `${path}/${docId}`);
    }
  };

  // Derived filter state
  const filteredTracks = useMemo(() => {
    if (selectedFilter === 'all') return tracks;
    return tracks.filter(t => t.status === selectedFilter);
  }, [tracks, selectedFilter]);

  // Derived statistics for beautiful bento grid cards
  const stats = useMemo(() => {
    const totalEpisodesStr = tracks.reduce((sum, t) => sum + t.episodesWatched, 0);
    const completedCount = tracks.filter(t => t.status === 'completed').length;
    const planningCount = tracks.filter(t => t.status === 'planning').length;
    const currentlyWatching = tracks.filter(t => t.status === 'watching').length;
    const ratedTracks = tracks.filter(t => t.score > 0);
    const averageScore = ratedTracks.length > 0
      ? (ratedTracks.reduce((sum, t) => sum + t.score, 0) / ratedTracks.length).toFixed(1)
      : '0.0';

    return {
      totalEpisodesStr,
      completedCount,
      planningCount,
      currentlyWatching,
      averageScore
    };
  }, [tracks]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#2C3E35] flex flex-col items-center justify-center gap-4">
        <div className="relative animate-bounce">
          <svg className="w-16 h-16 text-[#5F7D6D]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.47 2 2 6.47 2 12c0 1.25.23 2.45.66 3.56L1 21l5.52-1.63C7.59 19.78 8.78 20 10 20c5.53 0 10-4.47 10-10S15.53 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
          </svg>
          <div className="absolute top-1 left-2 w-2 h-2 rounded-full bg-white animate-ping"></div>
        </div>
        <p className="font-serif italic text-lg text-[#5F7D6D] tracking-wide">Stepping into the magical forest...</p>
      </div>
    );
  }

  // Beautiful status helper styling mappings
  const getStatusBadge = (status: AnimeTrack['status']) => {
    switch (status) {
      case 'watching':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#CFE0C3] text-[#3D5A47]">Currently Watching</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#D6E6F2] text-[#3F72AF]">Completed</span>;
      case 'planning':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#F7E2D6] text-[#A66155]">Plan to Watch</span>;
      case 'on_hold':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#F5F2D0] text-[#7A7539]">On Hold</span>;
      case 'dropped':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8DCDF] text-[#735F64]">Dropped</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C3E35] font-sans selection:bg-[#EBDCB9] flex flex-col relative overflow-x-hidden">
      
      {/* Absolute top notifications */}
      {notification && (
        <div 
          id="toast-notification"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg border flex items-center gap-3 transition-all duration-300 transform scale-102 font-serif text-sm ${
            notification.type === 'success' 
              ? 'bg-[#E5ECE9] border-[#5F7D6D]/40 text-[#2C3E35]' 
              : notification.type === 'error'
              ? 'bg-[#F2E5E5] border-[#C0694F]/40 text-[#5C2B1E]'
              : 'bg-[#E5EEF2] border-[#8BBBC9]/40 text-[#234A54]'
          }`}
        >
          <Sparkles className="w-4 h-4 animate-pulse shrink-0" />
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:scale-110">
            <X className="w-4 h-4 text-xs" />
          </button>
        </div>
      )}

      {/* Elegant Atmospheric Header */}
      <header id="app-header" className="border-b border-[#8D7C6E]/15 bg-[#FAF7F2]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand with elegant Serif */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#5F7D6D]/10 border border-[#5F7D6D]/30 flex items-center justify-center text-xl relative group">
              {/* Spinning soot sprite visual animation */}
              <div className="w-7 h-7 rounded-full bg-[#1E2220] flex items-center justify-center p-1 group-hover:scale-110 transition-transform relative">
                <div className="flex justify-between w-full absolute top-[7px] px-1">
                  <div className="w-2 h-2 rounded-full bg-white flex items-center justify-center relative">
                    <div className="w-1 h-1 rounded-full bg-black absolute bottom-[1px]"></div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-white flex items-center justify-center relative">
                    <div className="w-1 h-1 rounded-full bg-black absolute bottom-[1px]"></div>
                  </div>
                </div>
                {/* Sprites cute fuzzies */}
                <div className="absolute top-0 left-3 w-1 h-1 rounded-full bg-[#1E2220] -rotate-45"></div>
                <div className="absolute bottom-0 right-3 w-1 h-1 rounded-full bg-[#1E2220] -rotate-45"></div>
              </div>
            </div>
            
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#2C3E35] flex items-center gap-2">
                Anime Tracker
              </h1>
              <p className="text-xs text-[#5F7D6D]/80 font-serif italic">Your Cozy Anime Watch Companion</p>
            </div>
          </div>

          {/* Time indicator & session controls */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            
            {/* Live Clock to represent modern real states */}
            <div id="metadata-clock" className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#E5ECE9] rounded-full border border-[#5F7D6D]/15 text-xs text-[#5F7D6D]">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono tracking-wider">{currentTime}</span>
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-[#5F7D6D]/80 font-serif italic">Welcome traveler,</span>
                  <span className="text-xs font-semibold text-[#2C3E35]">{user.displayName || user.email}</span>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full border border-[#D7E3E5] shadow-sm" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#5F7D6D] text-white flex items-center justify-center font-bold text-sm">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <button
                  id="sign-out-btn"
                  onClick={handleSignOut}
                  className="p-2 text-[#C0694F] hover:bg-[#F2E5E5] rounded-xl transition-colors border border-[#C0694F]/10 text-xs flex items-center gap-1 font-serif"
                  title="Leave Forest Portal"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Leave</span>
                </button>
              </div>
            ) : (
              <button
                id="sign-in-header-btn"
                onClick={handleSignIn}
                className="px-4 py-2 bg-[#5F7D6D] hover:bg-[#4E6759] text-[#FAF7F2] font-serif rounded-xl text-xs sm:text-sm font-semibold transition-transform active:scale-95 shadow-md flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-yellow-200" />
                <span>Enter Portal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Welcome Backdrop for Unauthenticated Users */}
      {!user && (
        <section id="welcome-portal" className="flex-1 max-w-4xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
          
          {/* Whimsical watercolor-styled centerpiece */}
          <div className="relative w-full max-w-lg bg-[#FAF7F2] p-8 rounded-3xl border border-[#8D7C6E]/20 shadow-xl relative overflow-hidden backdrop-blur-sm">
            
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D7E3E5]/50 rounded-full blur-2xl -z-10"></div>
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-[#EBDCB9]/40 rounded-full blur-3xl -z-10"></div>
            
            {/* Floating soot sprite */}
            <div className="absolute top-5 right-8 animate-bounce delay-150 duration-2000 cursor-help group">
              <div className="w-8 h-8 rounded-full bg-[#1E2220] flex items-center justify-center p-1 relative">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center relative">
                    <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-0.5"></div>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center relative">
                    <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-0.5"></div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-10 -right-12 bg-[#2C3E35] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Fshhh! Let us track.
              </div>
            </div>

            <div className="mx-auto w-24 h-24 rounded-full bg-[#5F7D6D]/15 flex items-center justify-center mb-6 border-2 border-[#5F7D6D]/30 relative">
              {/* Cute sleeping Totoro shape illustration in pure SVG */}
              <svg className="w-16 h-16 text-[#5F7D6D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 21a8 8 0 0 0 8-8c0-2-1.5-5-2-5.5s-2 .5-2 .5-1-1.5-2-1.5-1 1.5-2 1.5-2-1-2-.5S10 8 8 13a8 8 0 0 0 4 8z" fill="currentColor" fillOpacity="0.1" />
                <path d="M10 5L9 2M14 5l1-3" strokeLinecap="round" />
                <circle cx="9.5" cy="11.5" r="1.2" fill="currentColor" />
                <circle cx="14.5" cy="11.5" r="1.2" fill="currentColor" />
                <path d="M11 14s.5.5 1 .5.5-.5.5-.5" strokeLinecap="round" />
                <path d="M8 17s1.5-1 4-1 4 1 4 1" strokeLinecap="round" />
              </svg>
            </div>

            <h2 className="font-serif text-3xl font-bold tracking-tight text-[#2C3E35] mb-2 leading-tight">
              In The Quiet Forest Garden
            </h2>
            <p className="font-serif italic text-sm text-[#5F7D6D] mb-6">
              "We must find that ancient, mossy tree where dreams and movies live together."
            </p>

            <blockquote className="text-xs sm:text-sm text-[#5F7D6D]/90 max-w-sm mx-auto mb-8 leading-relaxed border-l-2 border-[#5F7D6D]/40 pl-4 py-1 italic text-left">
              Begin your beautiful parchment notebook to record animes you are currently experiencing, plan to watch, or completed classics. Fully backed up to your private Google cloud cache.
            </blockquote>

            <div className="flex flex-col gap-3">
              <button
                id="sign-in-center-btn"
                onClick={handleSignIn}
                className="w-full py-3.5 px-6 bg-[#5F7D6D] hover:bg-[#4E6759] text-[#FAF7F2] font-serif rounded-2xl font-bold text-base transition-transform active:scale-98 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-yellow-200" />
                <span>Open Your Anime Journal</span>
              </button>
            </div>

            {connectionOk === false && (
              <p className="text-xs text-[#C0694F] mt-3 bg-red-50 p-2 rounded-lg">
                ⚠️ Forest database client is offline. Check firewall/credentials.
              </p>
            )}
          </div>

          <div className="mt-12 text-[#5F7D6D]/70 text-xs font-serif max-w-md">
            Built with respect for human imagination. Powered by Google AI Studio and Firestore database.
          </div>
        </section>
      )}

      {/* Core Tracker Workspace for Signed-In Users */}
      {user && (
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Catalog Selection & Live Anime Database */}
          <section id="catalog-section" className="lg:col-span-4 bg-[#FAF7F2] rounded-3xl border border-[#8D7C6E]/20 p-6 shadow-sm sticky top-24">
            
            {/* Quick tabs */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#E5ECE9] rounded-2xl mb-6">
              <button
                id="tab-curated"
                onClick={() => setActiveTab('curated')}
                className={`py-2 text-xs sm:text-sm font-serif font-semibold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'curated' 
                    ? 'bg-[#FAF7F2] text-[#2C3E35] shadow-sm' 
                    : 'text-[#5F7D6D] hover:text-[#2C3E35]'
                }`}
              >
                Currently Airing
              </button>
              <button
                id="tab-search"
                onClick={() => setActiveTab('search')}
                className={`py-2 text-xs sm:text-sm font-serif font-semibold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'search' 
                    ? 'bg-[#FAF7F2] text-[#2C3E35] shadow-sm' 
                    : 'text-[#5F7D6D] hover:text-[#2C3E35]'
                }`}
              >
                Search MAL
              </button>
            </div>

            {/* POPULAR ANIME VIEWS FROM JIKAN */}
            {activeTab === 'curated' && (
              <div>
                <div className="mb-4">
                  <h3 className="font-serif font-bold text-[#2C3E35] text-base">Trending Airing Anime</h3>
                  <p className="text-xs text-[#5F7D6D]/80">Most watched active seasonal series airing right now.</p>
                </div>

                {loadingPopular && (
                  <div className="py-20 flex flex-col items-center justify-center text-[#5F7D6D] gap-2">
                    <Loader2 className="w-7 h-7 animate-spin text-[#5F7D6D]/70" />
                    <p className="text-xs font-serif italic text-[#5F7D6D]/85">Opening ancient scrolls...</p>
                  </div>
                )}

                {popularError && (
                  <div className="p-3.5 bg-[#F2E5E5] border border-red-100 rounded-2xl text-xs text-[#5C2B1E] mb-3 leading-relaxed">
                    {popularError}
                  </div>
                )}

                {!loadingPopular && !popularError && (
                  <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                    {popularAnimes.map((item) => {
                      const idStr = String(item.mal_id);
                      const isAdded = tracks.some(t => t.animeId === idStr);
                      const docTrack = tracks.find(t => t.animeId === idStr);
                      const poster = item.images?.jpg?.image_url || 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200';
                      const yearVal = item.year || item.aired?.prop?.from?.year || '';

                      return (
                        <div 
                          id={`popular-item-${item.mal_id}`}
                          key={item.mal_id} 
                          className={`p-3 rounded-2xl border transition-all flex gap-3 ${
                            isAdded 
                              ? 'bg-[#E5ECE9]/60 border-[#5F7D6D]/30' 
                              : 'bg-white border-[#8D7C6E]/15 hover:border-[#5F7D6D]/40 hover:shadow-xs'
                          }`}
                        >
                          <div className="w-14 h-18 rounded-xl overflow-hidden bg-[#FAF7F2] shrink-0 border border-[#8D7C6E]/10 relative">
                            <img 
                              src={poster} 
                              alt={item.title} 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200';
                              }}
                            />
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-serif font-bold text-xs sm:text-sm text-[#2C3E35] leading-snug truncate" title={item.title}>
                                  {item.title}
                                </h4>
                                {yearVal && (
                                  <span className="text-[10px] text-[#5F7D6D] shrink-0 font-serif italic">({yearVal})</span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#5F7D6D]/95 line-clamp-1 mt-0.5 leading-relaxed">
                                {item.synopsis || "No description loaded."}
                              </p>
                            </div>

                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[9px] uppercase font-mono px-1 py-0.2 bg-[#FAF7F2] border border-[#8D7C6E]/10 rounded text-[#5F7D6D]">
                                {item.type || 'TV'} ({item.episodes || '?'})
                              </span>

                              {isAdded ? (
                                <button
                                  id={`track-popular-edit-${item.mal_id}`}
                                  onClick={() => docTrack && setEditingTrack(docTrack)}
                                  className="text-[10px] font-serif text-[#5F7D6D] hover:text-[#2C3E35] flex items-center gap-1 bg-[#FAF7F2] py-0.5 px-2 rounded-lg border border-[#8D7C6E]/15"
                                >
                                  <BookOpen className="w-3 h-3 text-[#5F7D6D]" />
                                  <span>Modify</span>
                                </button>
                              ) : (
                                <button
                                  id={`track-popular-add-${item.mal_id}`}
                                  onClick={() => handleTrackAnime({
                                    animeId: idStr,
                                    title: item.title,
                                    imageUrl: poster,
                                    animeType: item.type || 'TV',
                                    episodesCount: item.episodes || 1
                                  })}
                                  className="text-[10px] font-serif bg-[#5F7D6D]/10 hover:bg-[#5F7D6D] text-[#2C3E35] hover:text-[#FAF7F2] font-semibold py-0.5 px-2 rounded-lg border border-[#5F7D6D]/20 transition-all flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Save</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* LIVE ANIME DATABASE SEARCH VIEWS */}
            {activeTab === 'search' && (
              <div>
                <div className="mb-4">
                  <h3 className="font-serif font-bold text-[#2C3E35] text-base">Explore Global Anime</h3>
                  <p className="text-xs text-[#5F7D6D]/80">Integrate watch state for any series queried via Jikan MAL API.</p>
                </div>

                <form id="anime-search-form" onSubmit={triggerSearch} className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#5F7D6D] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="search-input"
                      type="text"
                      placeholder="Type anime title (e.g., Ghibli, Naruto...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs xs:text-sm pl-9 pr-3 py-2 rounded-xl bg-white border border-[#8D7C6E]/20 text-[#2C3E35] placeholder-[#5F7D6D]/50 focus:outline-none focus:border-[#5F7D6D]"
                    />
                  </div>
                  <button
                    id="search-submit-btn"
                    type="submit"
                    className="px-3.5 py-2 bg-[#5F7D6D] hover:bg-[#4E6759] text-white rounded-xl transition-all font-serif text-xs font-semibold shrink-0"
                    disabled={searching}
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                  </button>
                </form>

                {searching && (
                  <div className="py-12 flex flex-col items-center justify-center text-[#5F7D6D] gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p className="text-xs font-serif italic text-[#5F7D6D]/80">Whispering to forest spirits...</p>
                  </div>
                )}

                {searchError && (
                  <div id="search-error-block" className="p-3 bg-[#F2E5E5] border border-red-100 rounded-xl text-xs text-[#5C2B1E] mb-4">
                    {searchError}
                  </div>
                )}

                {!searching && !searchError && searchResults.length === 0 && (
                  <div className="py-12 text-center text-xs text-[#5F7D6D]/70 border-2 border-dashed border-[#8D7C6E]/15 rounded-2xl bg-white/50">
                    <HelpCircle className="w-6 h-6 mx-auto text-[#5F7D6D]/40 mb-1" />
                    <p className="font-serif italic font-medium">No results fetched yet.</p>
                    <p className="px-4 mt-1">Enter a title above to search standard anime databases securely.</p>
                  </div>
                )}

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {searchResults.map((item) => {
                    const isAdded = tracks.some(t => t.animeId === String(item.mal_id));
                    const docTrack = tracks.find(t => t.animeId === String(item.mal_id));
                    const poster = item.images?.jpg?.image_url || 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200';

                    return (
                      <div 
                        id={`search-item-${item.mal_id}`}
                        key={item.mal_id} 
                        className={`p-3 rounded-2xl border transition-all flex gap-3 ${
                          isAdded 
                            ? 'bg-[#E5ECE9]/60 border-[#5F7D6D]/30' 
                            : 'bg-white border-[#8D7C6E]/15 hover:border-[#5F7D6D]/30'
                        }`}
                      >
                        <img 
                          src={poster} 
                          alt={item.title} 
                          className="w-14 h-16 object-cover rounded-xl shrink-0 border border-[#8D7C6E]/10" 
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <h4 className="font-serif font-bold text-xs sm:text-sm text-[#2C3E35] truncate leading-tight">
                              {item.title}
                            </h4>
                            <p className="text-[10px] text-[#5F7D6D] line-clamp-1 mt-0.5">
                              {item.synopsis || "No description loaded."}
                            </p>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-[9px] uppercase font-mono px-1 rounded bg-[#FAF7F2] text-[#5F7D6D] border border-[#8D7C6E]/10">
                              {item.type || 'TV'} ({item.episodes || '?'})
                            </span>

                            {isAdded ? (
                              <button
                                id={`track-search-modify-${item.mal_id}`}
                                onClick={() => docTrack && setEditingTrack(docTrack)}
                                className="text-[10px] font-serif text-[#5F7D6D] hover:text-[#2C3E35] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#8D7C6E]/15"
                              >
                                Modify
                              </button>
                            ) : (
                              <button
                                id={`track-search-add-${item.mal_id}`}
                                onClick={() => handleTrackAnime({
                                  animeId: String(item.mal_id),
                                  title: item.title,
                                  imageUrl: poster,
                                  animeType: item.type || 'TV',
                                  episodesCount: item.episodes || 1
                                })}
                                className="text-[10px] font-serif bg-[#5F7D6D] hover:bg-[#4E6759] text-white py-0.5 px-2 rounded-lg transition-transform active:scale-95"
                              >
                                Add Track
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Right Main Panel: User Journal List & Stats */}
          <section id="tracker-journal-panel" className="lg:col-span-8 space-y-6">
            
            {/* Beautiful Bento Grid Stats Banner */}
            <div id="stats-dashboard" className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#E5ECE9]/70 p-4 sm:p-5 rounded-3xl border border-[#5F7D6D]/15">
              
              <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#5F7D6D]/10 flex flex-col justify-between">
                <span className="text-xs text-[#5F7D6D] font-serif italic">Total Tracked</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-[#2C3E35]">{tracks.length}</span>
                  <span className="text-xs text-[#5F7D6D]">shows</span>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#5F7D6D]/10 flex flex-col justify-between">
                <span className="text-xs text-[#5F7D6D] font-serif italic">Episodes Watched</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-[#2C3E35]">{stats.totalEpisodesStr}</span>
                  <span className="text-xs text-[#5F7D6D]">eps</span>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#5F7D6D]/10 flex flex-col justify-between">
                <span className="text-xs text-[#5F7D6D] font-serif italic">Finished Logs</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-[#2C3E35]">{stats.completedCount}</span>
                  <span className="text-xs text-[#5F7D6D]">completed</span>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#5F7D6D]/10 flex flex-col justify-between">
                <span className="text-xs text-[#5F7D6D] font-serif italic">Average Score</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-[#C0694F]">{stats.averageScore}</span>
                  <span className="text-xs text-[#5F7D6D]">/10.0</span>
                </div>
              </div>
            </div>

            {/* List Header and Interactive Status Filters */}
            <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#8D7C6E]/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#2C3E35] flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#5F7D6D]" />
                    <span>My Anime Journal parchment</span>
                  </h3>
                  <p className="text-xs text-[#5F7D6D]">Manage your tracking records and private notes securely.</p>
                </div>
                
                {/* Total indicators */}
                <div className="text-xs text-right font-serif text-[#5F7D6D] italic">
                  Showing {filteredTracks.length} of {tracks.length} entries
                </div>
              </div>

              {/* Status categories filters */}
              <div id="status-filters" className="flex flex-wrap gap-2">
                {(['all', 'watching', 'planning', 'completed', 'on_hold', 'dropped'] as const).map((filter) => {
                  const count = filter === 'all' ? tracks.length : tracks.filter(t => t.status === filter).length;
                  return (
                    <button
                      id={`filter-${filter}`}
                      key={filter}
                      onClick={() => setSelectedFilter(filter)}
                      className={`px-3 py-1.5 rounded-full text-xs font-serif transition-all flex items-center gap-1 bg-white cursor-pointer ${
                        selectedFilter === filter
                          ? 'bg-[#5F7D6D] text-white font-semibold border border-[#5F7D6D] shadow-xs'
                          : 'text-[#2C3E35] hover:text-[#5F7D6D] border border-[#8D7C6E]/15'
                      }`}
                    >
                      <span className="capitalize">{filter.replace('_', ' ')}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedFilter === filter ? 'bg-white/20 text-white' : 'bg-[#E5ECE9] text-[#5F7D6D]'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* EMPTY STATE */}
              {loadingTracks ? (
                <div className="py-24 flex flex-col items-center justify-center gap-2 text-[#5F7D6D]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="font-serif italic text-sm">Opening parchment database...</p>
                </div>
              ) : filteredTracks.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-[#8D7C6E]/12 flex flex-col items-center justify-center p-6">
                  <div className="w-12 h-12 rounded-full bg-[#E5ECE9] flex items-center justify-center text-[#5F7D6D] mb-3">
                    <Heart className="w-6 h-6 animate-pulse" />
                  </div>
                  <h4 className="font-serif font-bold text-[#2C3E35] text-base">No tracked entries in this grove</h4>
                  <p className="text-xs text-[#5F7D6D]/80 max-w-sm mt-1 leading-relaxed">
                    Select a curated masterpiece on the left catalog or search the global database to open your first tracked entry!
                  </p>
                </div>
              ) : (
                
                /* SECURE FIRESTORE SYNC GRID/LIST */
                <div id="tracked-anime-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTracks.map((track) => (
                    <div 
                      id={`track-card-${track.animeId}`}
                      key={track.id} 
                      className="bg-white rounded-2xl border border-[#8D7C6E]/15 shadow-xs overflow-hidden flex flex-col hover:border-[#5F7D6D]/45 hover:shadow-sm transition-all"
                    >
                      {/* Top ribbon container */}
                      <div className="p-3.5 flex gap-3.5 flex-1 items-start">
                        
                        {/* Soft rounded poster thumb */}
                        <div className="w-16 h-20 bg-[#FAF7F2] rounded-xl overflow-hidden shrink-0 border border-[#8D7C6E]/10 flex relative">
                          <img 
                            src={track.imageUrl} 
                            alt={track.title} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200';
                            }}
                          />
                        </div>

                        {/* Title, badge, and simple progress controls */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-full min-h-[80px]">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="font-serif font-bold text-sm text-[#2C3E35] leading-snug line-clamp-1 title-element" title={track.title}>
                                {track.title}
                              </h4>
                              <button
                                id={`trash-btn-${track.animeId}`}
                                onClick={() => handleDeleteTrack(track)}
                                className="p-1 hover:bg-[#F2E5E5] text-[#C0694F]/70 hover:text-[#C0694F] rounded-lg transition-colors border border-transparent hover:border-[#C0694F]/15 shrink-0"
                                title="Delete from Journal"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex gap-2 items-center mt-1">
                              {getStatusBadge(track.status)}
                              <span className="text-[10px] text-[#5F7D6D] uppercase font-mono">{track.animeType}</span>
                            </div>
                          </div>

                          {/* Interactive Episode Incrementors */}
                          <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 bg-[#E5ECE9]/60 p-0.5 rounded-lg border border-[#5F7D6D]/10 text-xs">
                              <button
                                id={`decrement-btn-${track.animeId}`}
                                onClick={() => handleIncrementEpisode(track, -1)}
                                className="w-5 h-5 bg-white text-[#2C3E35] active:bg-[#C2D6D3] rounded flex items-center justify-center font-bold hover:scale-105 shadow-xs shrink-0 cursor-pointer"
                                disabled={track.episodesWatched === 0}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-1.5 font-semibold text-[#2C3E35]">
                                {track.episodesWatched} <span className="text-[#5F7D6D]/80 font-normal">/ {track.episodesCount || '?'}</span>
                              </span>
                              <button
                                id={`increment-btn-${track.animeId}`}
                                onClick={() => handleIncrementEpisode(track, 1)}
                                className="w-5 h-5 bg-white text-[#2C3E35] active:bg-[#C2D6D3] rounded flex items-center justify-center font-bold hover:scale-105 shadow-xs shrink-0 cursor-pointer"
                                disabled={track.episodesWatched >= track.episodesCount}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Score Display (Stars / Acorns) */}
                            <div className="flex items-center gap-0.5">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                              <span className="text-xs font-serif font-bold text-[#2C3E35]">
                                {track.score > 0 ? `${track.score}.0` : 'No score'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Notes / Thoughts glimpse and Journal Entry toggle */}
                      <div className="border-t border-[#8D7C6E]/10 bg-[#FAF7F2]/50 p-2.5 flex items-center justify-between text-xs font-serif">
                        <div className="flex-1 min-w-0 mr-3 italic text-[#5F7D6D]/95 truncate">
                          {track.notes ? `"${track.notes}"` : "No journal thoughts recorded yet..."}
                        </div>
                        
                        <button
                          id={`write-notes-btn-${track.animeId}`}
                          onClick={() => {
                            setEditingTrack(track);
                            setJournalNotes(track.notes || '');
                            setJournalScore(track.score || 0);
                            setJournalEpWatched(track.episodesWatched || 0);
                            setJournalStatus(track.status || 'watching');
                          }}
                          className="px-2.5 py-1 text-[11px] bg-[#5F7D6D] hover:bg-[#4E6759] text-white hover:text-white rounded-lg transition-transform active:scale-95 flex items-center gap-1 shrink-0 font-sans cursor-pointer font-bold duration-150"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Parchment Notes</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* DIALOG: EDIT JOURNAL NOTES PARCHMENT */}
      {editingTrack && (
        <div id="journal-editor-overlay" className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            id="journal-editor-modal"
            className="w-full max-w-lg bg-[#FAF7F2] rounded-3xl border-2 border-[#8D7C6E]/25 shadow-2xl overflow-hidden relative transform transition-transform"
          >
            {/* Cute soot spirits decoration inside modal */}
            <div className="absolute top-2.5 right-11 flex gap-1 pointer-events-none">
              <div className="w-5 h-5 rounded-full bg-[#1E2220] flex items-center justify-center p-[2px] relative">
                <div className="w-1.5 h-1.5 rounded-full bg-white relative">
                  <div className="w-0.5 h-0.5 rounded-full bg-black absolute bottom-0.5"></div>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-white relative">
                  <div className="w-0.5 h-0.5 rounded-full bg-black absolute bottom-0.5"></div>
                </div>
              </div>
            </div>

            <button
              id="modal-close-btn"
              onClick={() => setEditingTrack(null)}
              className="absolute top-3.5 right-3.5 p-1.5 hover:bg-[#F2E5E5] text-[#C0694F] rounded-full transition-colors border border-transparent hover:border-[#C0694F]/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header banner details */}
            <div className="bg-[#E5ECE9] p-5 border-b border-[#5F7D6D]/15 flex items-center gap-4">
              <img 
                src={editingTrack.imageUrl} 
                alt={editingTrack.title} 
                className="w-12 h-16 object-cover rounded-lg border border-[#8D7C6E]/10" 
              />
              <div>
                <span className="text-[9px] uppercase tracking-wider font-mono bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#8D7C6E]/10 text-[#5F7D6D]">
                  {editingTrack.animeType}
                </span>
                <h3 className="font-serif font-bold text-base text-[#2C3E35] mt-1 leading-snug line-clamp-1">
                  {editingTrack.title}
                </h3>
                <p className="text-xs text-[#5F7D6D]/80 italic font-serif">Anime Tracking Parchment Entry</p>
              </div>
            </div>

            {/* Input fields */}
            <form id="journal-editor-form" onSubmit={handleSaveJournalDetails} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Watch Status */}
                <div>
                  <label id="lbl-status" className="block text-xs font-serif italic text-[#5F7D6D] mb-1">Watch Status</label>
                  <select
                    id="status-select"
                    value={journalStatus}
                    onChange={(e) => {
                      const nextStatus = e.target.value as any;
                      setJournalStatus(nextStatus);
                      if (nextStatus === 'completed' && editingTrack.episodesCount > 0) {
                        setJournalEpWatched(editingTrack.episodesCount);
                      }
                    }}
                    className="w-full text-xs font-serif bg-white border border-[#8D7C6E]/20 text-[#2C3E35] rounded-xl p-2 focus:outline-none focus:border-[#5F7D6D]"
                  >
                    <option value="watching">Currently Watching</option>
                    <option value="completed">Completed</option>
                    <option value="planning">Plan to Watch</option>
                    <option value="on_hold">On Hold</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>

                {/* Score Rating */}
                <div>
                  <label id="lbl-score" className="block text-xs font-serif italic text-[#5F7D6D] mb-1">Personal Rating</label>
                  <select
                    id="score-select"
                    value={journalScore}
                    onChange={(e) => setJournalScore(Number(e.target.value))}
                    className="w-full text-xs font-serif bg-white border border-[#8D7C6E]/20 text-[#2C3E35] rounded-xl p-2 focus:outline-none focus:border-[#5F7D6D]"
                  >
                    <option value={0}>No score given</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(star => (
                      <option key={star} value={star}>
                        {star} Stars {star === 10 ? '✨' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Episode count editor */}
              <div>
                <label id="lbl-episodes" className="block text-xs font-serif italic text-[#5F7D6D] mb-1">Episodes Watched</label>
                <div className="flex items-center gap-3 bg-white border border-[#8D7C6E]/20 p-2 rounded-xl text-sm">
                  <button
                    id="modal-dec-ep"
                    type="button"
                    onClick={() => setJournalEpWatched(prev => Math.max(0, prev - 1))}
                    className="w-6 h-6 bg-[#E5ECE9] hover:bg-[#CFE0C3] rounded flex items-center justify-center font-bold text-[#2C3E35]"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-semibold text-[#2C3E35]">
                    {journalEpWatched} / {editingTrack.episodesCount || '?'}
                  </span>
                  <button
                    id="modal-inc-ep"
                    type="button"
                    onClick={() => setJournalEpWatched(prev => Math.min(editingTrack.episodesCount, prev + 1))}
                    className="w-6 h-6 bg-[#E5ECE9] hover:bg-[#CFE0C3] rounded flex items-center justify-center font-bold text-[#2C3E35]"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Private Notes Context */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label id="lbl-notes" className="block text-xs font-serif italic text-[#5F7D6D]">Forest thoughts & Personal Journal</label>
                  <span className="text-[10px] text-[#5F7D6D]/70">{journalNotes.length}/5000 chars</span>
                </div>
                <textarea
                  id="journal-notes-textarea"
                  rows={4}
                  maxLength={5000}
                  placeholder="Record your feelings, notes and memory from this title..."
                  value={journalNotes}
                  onChange={(e) => setJournalNotes(e.target.value)}
                  className="w-full text-xs font-serif bg-white border border-[#8D7C6E]/20 text-[#2C3E35] rounded-xl p-3 focus:outline-none focus:border-[#5F7D6D] placeholder-[#5F7D6D]/40"
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  id="modal-cancel-btn"
                  type="button"
                  onClick={() => setEditingTrack(null)}
                  className="px-4 py-2 font-serif text-xs text-[#5F7D6D] hover:text-[#2C3E35] hover:bg-[#E5ECE9] rounded-xl transition-colors duration-150"
                >
                  Discard Changes
                </button>
                <button
                  id="modal-save-btn"
                  type="submit"
                  disabled={savingJournal}
                  className="px-5 py-2.5 font-serif text-xs bg-[#5F7D6D] hover:bg-[#4E6759] text-white font-bold rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5 duration-150 cursor-pointer"
                >
                  {savingJournal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Seal Parchment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Handcrafted footer matching constraints */}
      <footer id="app-footer" className="mt-auto border-t border-[#8D7C6E]/10 bg-[#FAF7F2] py-6 text-center text-[#5F7D6D]/80 text-xs font-serif">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} angewonk. All memories are stored securely.</p>
          <p className="flex items-center gap-1">

          </p>
        </div>
      </footer>
    </div>
  );
}
