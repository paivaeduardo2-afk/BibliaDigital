import { useState, useEffect, useMemo } from "react";
import { 
  Book, 
  CheckCircle, 
  ChevronRight, 
  Search, 
  StickyNote, 
  Menu, 
  X, 
  BookOpen, 
  BarChart2, 
  Trash2,
  Plus,
  ArrowLeft,
  Loader2,
  LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BIBLE_BOOKS, CATEGORIES, TESTAMENTS, BibleBook } from "./data/bible-metadata";
import { Login } from "./components/Login";

interface ReadChapter {
  book: string;
  chapter: number;
}

interface Highlight {
  book: string;
  chapter: number;
  verse: number;
}

interface Note {
  id: number;
  book: string;
  chapter: number;
  content: string;
  created_at: string;
}

interface BibleVerse {
  chapter: number;
  verse: number;
  text: string;
}

export default function App() {
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("bible_token"));
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [readChapters, setReadChapters] = useState<ReadChapter[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"read" | "notes" | "search" | "dashboard">("read");
  const [bibleText, setBibleText] = useState<BibleVerse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [importStatus, setImportStatus] = useState<{ isImporting: boolean; progress: number; totalVerses: number } | null>(null);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);

  const [isTogglingRead, setIsTogglingRead] = useState(false);

  // Log readChapters changes
  useEffect(() => {
    console.log("Current readChapters state:", readChapters);
  }, [readChapters]);

  // Fetch initial data
  useEffect(() => {
    console.log("Cookies enabled:", navigator.cookieEnabled);
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchProgress();
      fetchNotes();
      fetchHighlights();
    }
  }, [user]);

  const checkAuth = async () => {
    const storedToken = localStorage.getItem("bible_token");
    if (!storedToken) {
      setUser(null);
      setIsAuthChecking(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/me", { 
        headers: { "Authorization": `Bearer ${storedToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setToken(storedToken);
      } else {
        localStorage.removeItem("bible_token");
        setUser(null);
        setToken(null);
      }
    } catch (e) {
      console.error("Auth check failed");
      setUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleLogin = (userData: { id: number; username: string }, userToken: string) => {
    localStorage.setItem("bible_token", userToken);
    setToken(userToken);
    setUser(userData);
  };

  const handleLogout = async () => {
    localStorage.removeItem("bible_token");
    setToken(null);
    setUser(null);
    setSelectedBook(null);
    setReadChapters([]);
    setNotes([]);
    setActiveTab("read");
  };

  const fetchProgress = () => {
    if (!user || !token) return;
    console.log(`Fetching progress for user: ${user.username} (ID: ${user.id})...`);
    fetch("/api/progress", { 
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) {
          if (res.status === 401) {
            handleLogout();
          }
          throw new Error(`Progress fetch failed with status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log("Progress data received:", data);
        if (Array.isArray(data)) {
          // Merge with local state to avoid losing optimistic updates during sync
          setReadChapters(prev => {
            const safePrev = Array.isArray(prev) ? prev : [];
            const existing = new Set(safePrev.filter(rc => rc && rc.book).map(rc => `${rc.book.trim().toLowerCase()}-${rc.chapter}`));
            const newData = data.filter(rc => rc && rc.book && !existing.has(`${rc.book.trim().toLowerCase()}-${rc.chapter}`));
            return [...safePrev, ...newData];
          });
        }
      })
      .catch((err) => {
        console.error("Error fetching progress:", err);
      });
  };

  const fetchHighlights = () => {
    if (!user || !token) return;
    fetch("/api/highlights", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setHighlights(data.filter(h => h && h.book));
        }
      })
      .catch(err => console.error("Error fetching highlights:", err));
  };

  useEffect(() => {
    const checkStatus = () => {
      fetch("/api/bible/status", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          setImportStatus(data);
          if (data.isImporting) {
            setTimeout(checkStatus, 2000);
          }
        });
    };
    checkStatus();
  }, []);

  const fetchNotes = (query?: string) => {
    if (!user || !token) return;
    const url = query ? `/api/notes?q=${encodeURIComponent(query)}` : "/api/notes";
    fetch(url, { 
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNotes(data);
        } else {
          setNotes([]);
        }
      })
      .catch(() => setNotes([]));
  };

  useEffect(() => {
    if (selectedBook) {
      setIsLoading(true);
      fetch(`/api/bible/${encodeURIComponent(selectedBook.name)}/${selectedChapter}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setBibleText(data);
          } else {
            setBibleText([]);
          }
          setIsLoading(false);
        })
        .catch(() => {
          setBibleText([]);
          setIsLoading(false);
        });
    }
  }, [selectedBook, selectedChapter]);

  useEffect(() => {
    if (highlightedVerse && !isLoading && activeTab === "read") {
      const timer = setTimeout(() => {
        const element = document.getElementById(`verse-${highlightedVerse}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [bibleText, highlightedVerse, isLoading, activeTab]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    fetch(`/api/bible/search?q=${encodeURIComponent(searchQuery)}`)
      .then(res => res.json())
      .then(data => {
        setSearchResults(data);
        setIsSearching(false);
      })
      .catch(() => {
        setSearchResults([]);
        setIsSearching(false);
      });
  };

  const isChapterRead = (book: string, chapter: number) => {
    if (!Array.isArray(readChapters) || !book) return false;
    const searchBook = book.trim().toLowerCase();
    return readChapters.some(rc => 
      rc && rc.book && rc.book.trim().toLowerCase() === searchBook && rc.chapter === chapter
    );
  };

  const isVerseHighlighted = (book: string, chapter: number, verse: number) => {
    if (!Array.isArray(highlights) || !book) return false;
    const searchBook = book.trim().toLowerCase();
    return highlights.some(h => 
      h && h.book && h.book.trim().toLowerCase() === searchBook && h.chapter === chapter && h.verse === verse
    );
  };

  const toggleHighlight = (book: string, chapter: number, verse: number) => {
    if (!user || !token || !book) return;
    
    const isHighlighted = isVerseHighlighted(book, chapter, verse);
    const previousHighlights = [...highlights];

    // Optimistic update
    if (isHighlighted) {
      setHighlights(prev => (Array.isArray(prev) ? prev : []).filter(h => 
        !(h && h.book && h.book.trim().toLowerCase() === book.toLowerCase() && h.chapter === chapter && h.verse === verse)
      ));
    } else {
      setHighlights(prev => [...(Array.isArray(prev) ? prev : []), { book, chapter, verse }]);
    }

    fetch("/api/highlights", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ book, chapter, verse, highlight: !isHighlighted })
    }).then(res => {
      if (!res.ok) {
        setHighlights(previousHighlights);
        if (res.status === 401) handleLogout();
      }
    }).catch(() => {
      setHighlights(previousHighlights);
    });
  };

  const toggleRead = (book: string, chapter: number) => {
    if (isTogglingRead || !user || !token || !book) return;
    
    const bookName = book.trim();
    const isRead = isChapterRead(bookName, chapter);
    const previousReadChapters = [...readChapters];

    console.log(`Toggling read for "${bookName}" Ch ${chapter}. Current isRead: ${isRead}`);

    // Optimistic update
    if (isRead) {
      setReadChapters(prev => (Array.isArray(prev) ? prev : []).filter(rc => 
        !(rc && rc.book && rc.book.trim().toLowerCase() === bookName.toLowerCase() && rc.chapter === chapter)
      ));
    } else {
      setReadChapters(prev => [...(Array.isArray(prev) ? prev : []), { book: bookName, chapter }]);
    }

    setIsTogglingRead(true);
    fetch("/api/read", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ book: bookName, chapter, read: !isRead })
    }).then(res => {
      if (res.ok) {
        console.log("Toggle read successful on server");
      } else {
        // Rollback on error
        setReadChapters(previousReadChapters);
        console.error("Failed to toggle read status", res.status);
        if (res.status === 401) handleLogout();
      }
    })
    .catch(err => {
      // Rollback on network error
      setReadChapters(previousReadChapters);
      console.error("Network error toggling read status:", err);
    })
    .finally(() => setIsTogglingRead(false));
  };

  const addNote = () => {
    if (!selectedBook || !noteContent.trim() || !token) return;
    fetch("/api/notes", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ 
        book: selectedBook.name, 
        chapter: selectedChapter, 
        content: noteContent 
      })
    }).then(res => res.json()).then(() => {
      setNoteContent("");
      fetchNotes();
    });
  };

  const deleteNote = (id: number) => {
    if (!token) return;
    fetch(`/api/notes/${id}`, { 
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(() => fetchNotes());
  };

  const totalChapters = useMemo(() => BIBLE_BOOKS.reduce((acc, b) => acc + b.chapters, 0), []);
  const readCount = useMemo(() => {
    if (!Array.isArray(readChapters)) return 0;
    const unique = new Set(readChapters.filter(rc => rc && rc.book).map(rc => `${rc.book.trim().toLowerCase()}-${rc.chapter}`));
    return unique.size;
  }, [readChapters]);
  const progressPercent = totalChapters > 0 ? Math.round((readCount / totalChapters) * 100) : 0;

  const filteredNotes = notes;

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-netflix-black flex items-center justify-center">
        <Loader2 className="animate-spin text-netflix-red" size={48} />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-netflix-black text-white font-sans overflow-hidden selection:bg-netflix-red selection:text-white">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-netflix-red text-white rounded-full shadow-2xl hover:scale-110 transition-transform"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-80 bg-black flex flex-col h-full z-40 border-r border-white/5"
          >
            <div className="p-8">
              <h1 
                onClick={() => {
                  setSelectedBook(null);
                  setActiveTab("read");
                }}
                className="text-3xl font-bold tracking-tighter flex items-center gap-2 text-netflix-red cursor-pointer hover:scale-105 transition-transform"
              >
                BÍBLIA
              </h1>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 pb-8 space-y-10 no-scrollbar">
              {TESTAMENTS.map(testament => (
                <div key={testament} className="space-y-6">
                  <div className="flex items-center gap-4 px-4">
                    <h2 className="text-[14px] font-bold uppercase tracking-widest text-white/40 whitespace-nowrap">
                      {testament}
                    </h2>
                  </div>
                  
                  <div className="space-y-8">
                    {Array.from(new Set(BIBLE_BOOKS.filter(b => b.testament === testament).map(b => b.category))).map(category => (
                      <div key={category} className="space-y-3">
                        <h3 className="text-[11px] uppercase tracking-wider font-bold text-white/20 px-4">
                          {category}
                        </h3>
                        <div className="space-y-1">
                          {BIBLE_BOOKS.filter(b => b.testament === testament && b.category === category).map(book => (
                            <button
                              key={book.id}
                              onClick={() => {
                                setSelectedBook(book);
                                setSelectedChapter(1);
                                setHighlightedVerse(null);
                                setActiveTab("read");
                                if (window.innerWidth < 1024) setIsSidebarOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2 rounded text-sm font-medium transition-all flex items-center justify-between group ${
                                selectedBook?.id === book.id 
                                  ? "text-white border-l-4 border-netflix-red bg-white/5" 
                                  : "text-white/60 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              <span>{book.name}</span>
                              <ChevronRight size={14} className={`transition-transform duration-300 ${selectedBook?.id === book.id ? "translate-x-0 opacity-100 text-netflix-red" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-50"}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-6 bg-netflix-dark-gray/50 border-t border-white/5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">
                <div className="flex items-center gap-2">
                  <span>Progresso</span>
                  <button 
                    onClick={fetchProgress}
                    className="hover:text-white transition-colors"
                    title="Sincronizar"
                  >
                    <Loader2 size={10} className={isTogglingRead ? "animate-spin" : ""} />
                  </button>
                </div>
                <span className="text-netflix-red">{progressPercent}%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-netflix-red"
                />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-netflix-black">
        {/* Import Status Bar */}
        {importStatus?.isImporting && (
          <div className="bg-netflix-red text-white px-6 py-1 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-between z-50">
            <span className="flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Sincronizando... {importStatus.progress}%
            </span>
            <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-500" style={{ width: `${importStatus.progress}%` }} />
            </div>
          </div>
        )}

        {/* Header Navigation */}
        <header className="h-16 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-8 z-30 sticky top-0">
          <div className="flex items-center gap-6">
            {[
              { id: "read", label: "Início" },
              { id: "notes", label: "Notas" },
              { id: "search", label: "Busca" },
              { id: "dashboard", label: "Meu Progresso" }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === "read") setSelectedBook(null);
                }}
                className={`text-sm font-medium transition-all ${
                  activeTab === tab.id 
                    ? "text-white font-bold" 
                    : "text-white/70 hover:text-white/90"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-xs font-bold">
                {user.username[0].toUpperCase()}
              </div>
              <span className="text-sm font-bold hidden sm:inline">{user.username}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-white/60 hover:text-white transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === "read" && (
              <motion.div 
                key="read"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pb-20"
              >
                {!selectedBook ? (
                  <div className="space-y-12 pb-20">
                    <div className="relative h-[70vh] w-full flex items-center px-12 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-netflix-black via-netflix-black/40 to-transparent z-10" />
                      <div className="absolute inset-0 bg-gradient-to-t from-netflix-black via-transparent to-transparent z-10" />
                      <img 
                        src="https://picsum.photos/seed/bible-hero/1920/1080?blur=5" 
                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                        alt="Hero"
                        referrerPolicy="no-referrer"
                      />
                      <div className="relative z-20 max-w-2xl space-y-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-netflix-red rounded-sm flex items-center justify-center text-[10px] font-black">B</div>
                          <span className="text-xs font-bold tracking-[0.3em] text-white/60 uppercase">Original da Palavra</span>
                        </div>
                        <h2 className="text-8xl font-black tracking-tighter leading-none">A BÍBLIA</h2>
                        <div className="flex items-center gap-4 text-sm font-bold">
                          <span className="text-green-500">99% Relevante</span>
                          <span className="text-white/60">2026</span>
                          <span className="border border-white/40 px-1 rounded-sm text-[10px]">LIVRE</span>
                          <span className="text-white/60">66 Livros</span>
                        </div>
                        <p className="text-xl text-white/90 leading-relaxed max-w-lg font-medium">
                          A coleção definitiva de textos sagrados que moldaram a história. Uma jornada épica de fé, redenção e sabedoria eterna.
                        </p>
                        <div className="flex items-center gap-4 pt-4">
                          <button 
                            onClick={() => {
                              const lastRead = readChapters[readChapters.length - 1];
                              if (lastRead) {
                                const book = BIBLE_BOOKS.find(b => b.name === lastRead.book);
                                if (book) {
                                  setSelectedBook(book);
                                  setSelectedChapter(lastRead.chapter);
                                }
                              } else {
                                setSelectedBook(BIBLE_BOOKS[0]);
                                setSelectedChapter(1);
                              }
                              setActiveTab("read");
                            }}
                            className="bg-white text-black font-bold py-3 px-10 rounded flex items-center gap-3 text-xl hover:bg-white/90 transition-all active:scale-95"
                          >
                            <BookOpen size={28} fill="currentColor" />
                            Ler Agora
                          </button>
                          <button 
                            onClick={() => setActiveTab("dashboard")}
                            className="bg-white/20 text-white font-bold py-3 px-10 rounded flex items-center gap-3 text-xl hover:bg-white/30 transition-all backdrop-blur-md active:scale-95"
                          >
                            <BarChart2 size={28} />
                            Meu Progresso
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Continue Reading Section */}
                    {readChapters.length > 0 && (
                      <div className="px-12 space-y-4">
                        <h3 className="text-2xl font-bold">Continuar Lendo</h3>
                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                          {Array.from(new Set(readChapters.map(rc => rc.book))).slice(-5).reverse().map(bookName => {
                            const book = BIBLE_BOOKS.find(b => b.name === bookName);
                            if (!book) return null;
                            const lastChapter = readChapters.filter(rc => rc.book === bookName).pop()?.chapter || 1;
                            return (
                              <button
                                key={book.id}
                                onClick={() => {
                                  setSelectedBook(book);
                                  setSelectedChapter(lastChapter);
                                }}
                                className="flex-shrink-0 w-64 aspect-video bg-netflix-dark-gray rounded-md overflow-hidden relative group transition-all duration-300 hover:scale-110 hover:z-20 border border-white/5"
                              >
                                <img 
                                  src={`https://picsum.photos/seed/${book.id}/400/225`} 
                                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                  alt={book.name}
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                                <div className="absolute bottom-4 left-4 text-left">
                                  <div className="text-xs font-bold text-netflix-red uppercase tracking-widest mb-1">{book.category}</div>
                                  <div className="text-lg font-bold">{book.name}</div>
                                  <div className="text-[10px] text-white/60 font-bold">Capítulo {lastChapter}</div>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                  <BookOpen size={48} className="text-white" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Browse by Category Rows */}
                    {CATEGORIES.slice(0, 4).map(category => (
                      <div key={category} className="px-12 space-y-4">
                        <h3 className="text-2xl font-bold">{category}</h3>
                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                          {BIBLE_BOOKS.filter(b => b.category === category).map(book => (
                            <button
                              key={book.id}
                              onClick={() => {
                                setSelectedBook(book);
                                setSelectedChapter(1);
                              }}
                              className="flex-shrink-0 w-48 aspect-[2/3] bg-netflix-dark-gray rounded-md overflow-hidden relative group transition-all duration-300 hover:scale-110 hover:z-20 border border-white/5"
                            >
                              <img 
                                src={`https://picsum.photos/seed/${book.id}/300/450`} 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                alt={book.name}
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                              <div className="absolute bottom-4 left-4 text-left">
                                <div className="text-lg font-bold">{book.name}</div>
                                <div className="text-[10px] text-white/60 font-bold">{book.chapters} Capítulos</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-12 pb-20">
                    <div className="relative h-[50vh] w-full flex items-end px-12 pb-12 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-netflix-black via-netflix-black/20 to-transparent z-10" />
                      <img 
                        src={`https://picsum.photos/seed/${selectedBook.id}/1920/1080?blur=2`} 
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                        alt={selectedBook.name}
                        referrerPolicy="no-referrer"
                      />
                      <div className="relative z-20 space-y-4">
                        <button 
                          onClick={() => setSelectedBook(null)}
                          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4 font-bold uppercase tracking-widest text-xs"
                        >
                          <ArrowLeft size={16} />
                          Voltar ao Início
                        </button>
                        <div className="flex flex-col gap-1">
                          <span className="text-netflix-red font-bold uppercase tracking-widest text-sm">
                            {selectedBook.category}
                          </span>
                          <h2 className="text-7xl font-black tracking-tighter">{selectedBook.name}</h2>
                        </div>
                        <div className="flex items-center gap-4 text-white/60 text-sm font-bold pt-2">
                          <span className="text-green-500">98% Relevante</span>
                          <span>{selectedBook.chapters} Capítulos</span>
                          <span className="border border-white/40 px-1 rounded-sm text-[10px]">LIVRE</span>
                          <span>HD</span>
                        </div>
                      </div>
                    </div>

                    <div className="px-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
                      <div className="lg:col-span-2 space-y-12">
                        <div className="space-y-6">
                          <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <h3 className="text-2xl font-bold">Capítulo {selectedChapter}</h3>
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => toggleRead(selectedBook.name, selectedChapter)}
                                disabled={isTogglingRead}
                                className={`flex items-center gap-2 px-6 py-2 rounded font-bold transition-all ${
                                  isChapterRead(selectedBook.name, selectedChapter)
                                    ? "bg-netflix-red text-white border border-netflix-red shadow-[0_0_10px_rgba(229,9,20,0.5)]"
                                    : "bg-white text-black hover:bg-white/90"
                                } ${isTogglingRead ? "opacity-50 cursor-not-allowed" : ""}`}
                              >
                                {isTogglingRead ? (
                                  <Loader2 size={20} className="animate-spin" />
                                ) : (
                                  <CheckCircle size={20} />
                                )}
                                {isChapterRead(selectedBook.name, selectedChapter) ? "Concluído" : "Marcar Lido"}
                              </button>
                            </div>
                          </div>

                          <div className="bg-netflix-dark-gray/20 rounded-lg p-8 min-h-[400px]">
                            {isLoading ? (
                              <div className="h-full flex items-center justify-center py-40">
                                <Loader2 className="animate-spin text-netflix-red" size={48} />
                              </div>
                            ) : (
                              <div className="space-y-8">
                                {bibleText.map(verse => (
                                  <p 
                                    key={verse.verse} 
                                    id={`verse-${verse.verse}`}
                                    onClick={() => toggleHighlight(selectedBook.name, selectedChapter, verse.verse)}
                                    className={`leading-relaxed text-xl transition-all duration-500 p-4 rounded group cursor-pointer relative ${
                                      isVerseHighlighted(selectedBook.name, selectedChapter, verse.verse)
                                        ? "bg-yellow-500/20 ring-1 ring-yellow-500/40" 
                                        : highlightedVerse === verse.verse 
                                          ? "bg-white/10 ring-1 ring-white/20" 
                                          : "hover:bg-white/5"
                                    }`}
                                  >
                                    <span className="inline-block w-8 text-xs font-bold text-netflix-red mr-4 opacity-60">
                                      {verse.verse}
                                    </span>
                                    <span className="text-white/90">{verse.text}</span>
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase font-bold tracking-widest text-white/40">
                                      {isVerseHighlighted(selectedBook.name, selectedChapter, verse.verse) ? "Remover Destaque" : "Destacar"}
                                    </span>
                                  </p>
                                ))}

                                <div className="pt-12 flex justify-center border-t border-white/5 mt-12">
                                  <button
                                    onClick={() => toggleRead(selectedBook.name, selectedChapter)}
                                    disabled={isTogglingRead}
                                    className={`flex items-center gap-3 px-10 py-4 rounded-md font-bold text-lg transition-all ${
                                      isChapterRead(selectedBook.name, selectedChapter)
                                        ? "bg-netflix-red text-white border border-netflix-red shadow-[0_0_20px_rgba(229,9,20,0.4)]"
                                        : "bg-white text-black hover:bg-white/90"
                                    } ${isTogglingRead ? "opacity-50 cursor-not-allowed" : ""}`}
                                  >
                                    {isTogglingRead ? (
                                      <Loader2 size={24} className="animate-spin" />
                                    ) : (
                                      <CheckCircle size={24} />
                                    )}
                                    {isChapterRead(selectedBook.name, selectedChapter) ? "Capítulo Concluído" : "Marcar Capítulo como Lido"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Note Input */}
                        <div className="bg-netflix-dark-gray/40 rounded-lg p-8 border border-white/5">
                          <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <StickyNote size={20} className="text-netflix-red" />
                            Minhas Reflexões
                          </h4>
                          <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="O que esta leitura despertou em você?"
                            className="w-full h-32 p-4 bg-netflix-black rounded border border-white/10 focus:border-netflix-red outline-none resize-none mb-4 transition-all text-white/80"
                          />
                          <div className="flex justify-end">
                            <button
                              onClick={addNote}
                              disabled={!noteContent.trim()}
                              className="netflix-button disabled:opacity-30"
                            >
                              Salvar Nota
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-8">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold">Capítulos</h3>
                          <span className="text-white/40 text-sm font-bold">{selectedBook.chapters} no total</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(ch => (
                            <button
                              key={ch}
                              onClick={() => {
                                setSelectedChapter(ch);
                                setHighlightedVerse(null);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`h-20 rounded flex flex-col items-center justify-center gap-1 transition-all border ${
                                selectedChapter === ch 
                                  ? `bg-white text-black border-white scale-105 z-10 shadow-2xl ${
                                      isChapterRead(selectedBook.name, ch)
                                        ? "ring-2 ring-netflix-red ring-offset-2 ring-offset-netflix-black"
                                        : ""
                                    }`
                                  : isChapterRead(selectedBook.name, ch)
                                    ? "bg-netflix-red text-white border-netflix-red shadow-[0_0_15px_rgba(229,9,20,0.3)]"
                                    : "bg-netflix-dark-gray text-white/60 border-white/5 hover:bg-netflix-light-gray hover:text-white"
                              }`}
                            >
                              <span className="text-xs font-black uppercase tracking-tighter opacity-40">CAP</span>
                              <span className="text-2xl font-black">{ch}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "notes" && (
              <motion.div 
                key="notes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-12 pt-8 space-y-12"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-4xl font-bold">Minhas Notas</h2>
                  <div className="relative w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                    <input
                      type="text"
                      placeholder="Buscar notas..."
                      value={noteSearch}
                      onChange={(e) => {
                        setNoteSearch(e.target.value);
                        fetchNotes(e.target.value);
                      }}
                      className="w-full pl-12 pr-4 py-2 bg-netflix-dark-gray border border-white/10 rounded outline-none text-sm focus:border-white/30 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {filteredNotes.map((note) => (
                    <motion.div 
                      layout
                      key={note.id}
                      className="bg-netflix-dark-gray p-6 rounded-lg border border-white/5 group hover:scale-105 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-netflix-red uppercase tracking-widest">
                          {note.book} {note.chapter}
                        </span>
                        <button 
                          onClick={() => deleteNote(note.id)}
                          className="text-white/20 hover:text-netflix-red transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed mb-6 line-clamp-4">{note.content}</p>
                      <div className="text-[10px] text-white/30 font-bold uppercase">
                        {new Date(note.created_at).toLocaleDateString()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "search" && (
              <motion.div 
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-12 pt-8 space-y-12"
              >
                <div className="max-w-3xl mx-auto space-y-8 text-center">
                  <h2 className="text-5xl font-bold tracking-tighter">Busca Inteligente</h2>
                  <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40" size={24} />
                    <input
                      type="text"
                      placeholder="Busque por palavras, temas ou personagens..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full pl-16 pr-32 py-5 bg-netflix-dark-gray border border-white/10 rounded-lg outline-none text-lg focus:border-netflix-red transition-all"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 netflix-button"
                    >
                      {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Buscar"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto">
                  {searchResults.map((result) => (
                    <motion.div
                      key={`${result.book}-${result.chapter}-${result.verse}`}
                      className="bg-netflix-dark-gray p-6 rounded-lg border border-white/5 hover:bg-white/5 transition-all cursor-pointer group"
                      onClick={() => {
                        const book = BIBLE_BOOKS.find(b => b.name === result.book);
                        if (book) {
                          setSelectedBook(book);
                          setSelectedChapter(result.chapter);
                          setHighlightedVerse(result.verse);
                          setActiveTab("read");
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-netflix-red uppercase tracking-widest">
                          {result.book} {result.chapter}:{result.verse}
                        </span>
                        <ChevronRight size={16} className="text-white/20 group-hover:text-white transition-all" />
                      </div>
                      <p className="text-white/80 text-lg leading-relaxed">{result.text}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "dashboard" && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-12 pt-8 space-y-12"
              >
                <h2 className="text-4xl font-bold">Meu Perfil de Leitura</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { label: "Capítulos Lidos", value: readCount, sub: `de ${totalChapters}`, icon: BookOpen },
                    { label: "Conclusão Total", value: `${progressPercent}%`, sub: "da Bíblia", icon: BarChart2 },
                    { label: "Suas Notas", value: notes.length, sub: "reflexões salvas", icon: StickyNote }
                  ].map((stat) => (
                    <div key={stat.label} className="bg-netflix-dark-gray p-8 rounded-lg border border-white/5">
                      <stat.icon className="text-netflix-red mb-4" size={24} />
                      <div className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</div>
                      <div className="text-5xl font-bold mb-1">{stat.value}</div>
                      <div className="text-xs text-white/30 font-medium">{stat.sub}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-netflix-dark-gray p-8 rounded-lg border border-white/5">
                  <h3 className="text-lg font-bold mb-8">Progresso por Seção</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {CATEGORIES.map(cat => {
                      const catBooks = BIBLE_BOOKS.filter(b => b.category === cat);
                      const catTotal = catBooks.reduce((acc, b) => acc + b.chapters, 0);
                      const catRead = readChapters.filter(rc => catBooks.some(b => b.name === rc.book)).length;
                      const catPercent = Math.round((catRead / catTotal) * 100);

                      return (
                        <div key={cat} className="space-y-2">
                          <div className="flex justify-between text-sm font-bold">
                            <span className="text-white/80">{cat}</span>
                            <span className="text-netflix-red">{catPercent}%</span>
                          </div>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${catPercent}%` }}
                              transition={{ duration: 1.5 }}
                              className="h-full bg-netflix-red"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
