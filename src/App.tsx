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
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BIBLE_BOOKS, CATEGORIES, BibleBook } from "./data/bible-metadata";

interface ReadChapter {
  book: string;
  chapter: number;
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
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [readChapters, setReadChapters] = useState<ReadChapter[]>([]);
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

  // Fetch initial data
  useEffect(() => {
    fetch("/api/progress")
      .then(res => res.json())
      .then(data => setReadChapters(data));
    
    fetchNotes();

    const checkStatus = () => {
      fetch("/api/bible/status")
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
    const url = query ? `/api/notes?q=${encodeURIComponent(query)}` : "/api/notes";
    fetch(url)
      .then(res => res.json())
      .then(data => setNotes(data));
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

  const toggleRead = (book: string, chapter: number) => {
    const isRead = readChapters.some(rc => rc.book === book && rc.chapter === chapter);
    fetch("/api/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, chapter, read: !isRead })
    }).then(() => {
      if (isRead) {
        setReadChapters(prev => prev.filter(rc => !(rc.book === book && rc.chapter === chapter)));
      } else {
        setReadChapters(prev => [...prev, { book, chapter }]);
      }
    });
  };

  const addNote = () => {
    if (!selectedBook || !noteContent.trim()) return;
    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    fetch(`/api/notes/${id}`, { method: "DELETE" })
      .then(() => fetchNotes());
  };

  const totalChapters = useMemo(() => BIBLE_BOOKS.reduce((acc, b) => acc + b.chapters, 0), []);
  const readCount = readChapters.length;
  const progressPercent = Math.round((readCount / totalChapters) * 100);

  const filteredNotes = notes;

  return (
    <div className="flex h-screen bg-bible-bg text-bible-ink font-sans overflow-hidden selection:bg-bible-accent/10">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-bible-accent text-white rounded-full shadow-2xl hover:scale-110 transition-transform"
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
            className="w-80 bg-white/40 backdrop-blur-xl border-r border-bible-border flex flex-col h-full z-40"
          >
            <div className="p-8">
              <h1 className="text-3xl font-serif font-bold tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-bible-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-bible-accent/20">
                  <Book size={20} />
                </div>
                Bíblia
              </h1>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 pb-8 space-y-8 no-scrollbar">
              {CATEGORIES.map(category => (
                <div key={category} className="space-y-3">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-bible-muted px-4">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {BIBLE_BOOKS.filter(b => b.category === category).map(book => (
                      <button
                        key={book.id}
                        onClick={() => {
                          setSelectedBook(book);
                          setSelectedChapter(1);
                          setHighlightedVerse(null);
                          setActiveTab("read");
                          if (window.innerWidth < 1024) setIsSidebarOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between group ${
                          selectedBook?.id === book.id 
                            ? "bg-bible-accent text-white shadow-md shadow-bible-accent/10" 
                            : "text-bible-ink/60 hover:bg-bible-accent/5 hover:text-bible-ink"
                        }`}
                      >
                        <span>{book.name}</span>
                        <ChevronRight size={14} className={`transition-transform duration-300 ${selectedBook?.id === book.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-50"}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-6 bg-white/50 border-t border-bible-border">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-bible-muted mb-3">
                <span>Leitura Concluída</span>
                <span className="text-bible-accent">{progressPercent}%</span>
              </div>
              <div className="h-1.5 bg-bible-accent/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-bible-accent"
                />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Import Status Bar */}
        {importStatus?.isImporting && (
          <div className="bg-bible-accent text-white px-6 py-2 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-between z-50">
            <span className="flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Sincronizando Escrituras... {importStatus.progress}%
            </span>
            <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-500" style={{ width: `${importStatus.progress}%` }} />
            </div>
          </div>
        )}

        {/* Header Navigation */}
        <header className="h-20 bg-white/40 backdrop-blur-md border-b border-bible-border flex items-center justify-between px-8 z-30">
          <div className="flex items-center gap-1 bg-bible-accent/5 p-1 rounded-2xl">
            {[
              { id: "read", icon: BookOpen, label: "Leitura" },
              { id: "notes", icon: StickyNote, label: "Notas" },
              { id: "search", icon: Search, label: "Busca" },
              { id: "dashboard", icon: BarChart2, label: "Progresso" }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id 
                    ? "bg-white text-bible-accent shadow-sm" 
                    : "text-bible-muted hover:text-bible-ink"
                }`}
              >
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-bible-muted">Sessão de Leitura</span>
              <span className="text-xs font-medium">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-12 no-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === "read" && (
              <motion.div 
                key="read"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto"
              >
                {!selectedBook ? (
                  <div className="h-[60vh] flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 bg-bible-accent/5 rounded-[2.5rem] flex items-center justify-center text-bible-accent/20 mb-8">
                      <BookOpen size={48} />
                    </div>
                    <h2 className="text-4xl font-serif font-bold mb-4">Inicie sua Leitura</h2>
                    <p className="text-bible-muted max-w-sm mx-auto leading-relaxed">
                      Selecione um dos livros sagrados na barra lateral para começar sua jornada de reflexão e estudo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-12">
                    <div className="space-y-8">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-bible-muted mb-2 block">
                            {selectedBook.category}
                          </span>
                          <h2 className="text-6xl font-serif font-bold tracking-tight">{selectedBook.name}</h2>
                        </div>
                        
                        <button
                          onClick={() => toggleRead(selectedBook.name, selectedChapter)}
                          className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-sm font-bold transition-all shadow-xl hover:scale-105 active:scale-95 ${
                            readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === selectedChapter)
                              ? "bg-bible-accent text-white shadow-bible-accent/20"
                              : "bg-white border border-bible-border text-bible-accent hover:border-bible-accent/40"
                          }`}
                        >
                          <CheckCircle size={20} />
                          {readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === selectedChapter) ? "Capítulo Lido" : "Marcar como Lido"}
                        </button>
                      </div>

                      <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar">
                        {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(ch => (
                          <button
                            key={ch}
                            onClick={() => {
                              setSelectedChapter(ch);
                              setHighlightedVerse(null);
                            }}
                            className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-all ${
                              selectedChapter === ch 
                                ? "bg-bible-accent text-white shadow-lg shadow-bible-accent/20 scale-110" 
                                : readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === ch)
                                  ? "bg-bible-accent/10 text-bible-accent border border-bible-accent/20"
                                  : "bg-white border border-bible-border text-bible-ink/40 hover:border-bible-accent/40 hover:text-bible-accent"
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="card-elegant p-10 lg:p-20 relative">
                      {isLoading ? (
                        <div className="h-full flex items-center justify-center py-40">
                          <Loader2 className="animate-spin text-bible-accent" size={48} />
                        </div>
                      ) : (
                        <div className="max-w-2xl mx-auto">
                          <div className="text-center mb-16">
                            <h3 className="text-3xl font-serif italic text-bible-muted mb-4">
                              Capítulo {selectedChapter}
                            </h3>
                            <div className="w-12 h-0.5 bg-bible-accent/20 mx-auto" />
                          </div>
                          
                          <div className="space-y-10">
                            {bibleText.map(verse => (
                              <p 
                                key={verse.verse} 
                                id={`verse-${verse.verse}`}
                                className={`leading-[1.8] text-xl font-serif transition-all duration-1000 p-4 rounded-2xl ${
                                  highlightedVerse === verse.verse 
                                    ? "bg-bible-accent/5 ring-1 ring-bible-accent/10 shadow-inner" 
                                    : "hover:bg-bible-accent/[0.02]"
                                }`}
                              >
                                <span className="inline-block w-8 text-[10px] font-mono font-bold text-bible-accent/40 mr-4 align-top mt-2">
                                  {verse.verse.toString().padStart(2, '0')}
                                </span>
                                <span className="text-bible-ink/90">{verse.text}</span>
                              </p>
                            ))}
                          </div>

                          <div className="mt-24 pt-12 border-t border-bible-border flex flex-col items-center gap-8">
                            <button
                              onClick={() => toggleRead(selectedBook.name, selectedChapter)}
                              className={`flex items-center gap-4 px-10 py-5 rounded-[2rem] text-lg font-bold transition-all shadow-2xl hover:scale-105 active:scale-95 ${
                                readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === selectedChapter)
                                  ? "bg-bible-accent text-white shadow-bible-accent/30"
                                  : "bg-white border-2 border-bible-accent/10 text-bible-accent hover:border-bible-accent/30"
                              }`}
                            >
                              <CheckCircle size={24} />
                              {readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === selectedChapter) ? "Capítulo Concluído" : "Finalizar Leitura"}
                            </button>
                            
                            <p className="text-xs font-bold uppercase tracking-[0.3em] text-bible-muted">
                              Palavra do Senhor
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Elegant Note Input */}
                    <div className="card-elegant p-10 overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-bible-accent/5 rounded-bl-[5rem] -mr-8 -mt-8" />
                      <div className="relative">
                        <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-bible-muted mb-6 flex items-center gap-3">
                          <StickyNote size={14} />
                          Reflexões do Dia
                        </h4>
                        <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder={`O que o Espírito falou ao seu coração em ${selectedBook.name} ${selectedChapter}?`}
                          className="w-full h-40 p-6 bg-bible-bg/50 rounded-3xl border border-bible-border focus:border-bible-accent/30 focus:ring-4 focus:ring-bible-accent/5 outline-none resize-none mb-6 transition-all font-serif text-lg leading-relaxed"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={addNote}
                            disabled={!noteContent.trim()}
                            className="flex items-center gap-3 px-8 py-3.5 bg-bible-accent text-white rounded-2xl text-sm font-bold hover:bg-bible-accent/90 disabled:opacity-30 transition-all shadow-lg shadow-bible-accent/20"
                          >
                            <Plus size={18} />
                            Guardar Reflexão
                          </button>
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-5xl mx-auto space-y-12"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-bible-muted">Seu Diário Espiritual</span>
                    <h2 className="text-5xl font-serif font-bold">Minhas Notas</h2>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-bible-muted" size={18} />
                    <input
                      type="text"
                      placeholder="Buscar em suas reflexões..."
                      value={noteSearch}
                      onChange={(e) => {
                        setNoteSearch(e.target.value);
                        fetchNotes(e.target.value);
                      }}
                      className="w-full pl-14 pr-6 py-4 bg-white border border-bible-border rounded-2xl text-sm font-medium focus:ring-4 focus:ring-bible-accent/5 focus:border-bible-accent/20 outline-none shadow-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {filteredNotes.map((note, idx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      key={note.id}
                      className="card-elegant p-8 group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-bible-accent/5 rounded-lg flex items-center justify-center text-bible-accent">
                            <Book size={14} />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-bible-accent">
                            {note.book} {note.chapter}
                          </span>
                        </div>
                        <button 
                          onClick={() => deleteNote(note.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-bible-muted hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="text-bible-ink/80 font-serif text-lg leading-relaxed mb-8 italic">"{note.content}"</p>
                      <div className="flex items-center gap-2 text-[10px] text-bible-muted font-bold uppercase tracking-widest">
                        <div className="w-1 h-1 bg-bible-accent/30 rounded-full" />
                        {new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                    </motion.div>
                  ))}
                  {filteredNotes.length === 0 && (
                    <div className="col-span-full py-32 text-center">
                      <div className="w-20 h-20 bg-bible-accent/5 rounded-[2rem] flex items-center justify-center text-bible-accent/20 mx-auto mb-6">
                        <StickyNote size={32} />
                      </div>
                      <p className="text-bible-muted font-medium">Nenhuma reflexão encontrada em seu diário.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "search" && (
              <motion.div 
                key="search"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-5xl mx-auto space-y-12"
              >
                <div className="space-y-8 text-center max-w-2xl mx-auto">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-bible-muted">Explorar as Escrituras</span>
                    <h2 className="text-5xl font-serif font-bold">Busca Bíblica</h2>
                  </div>
                  <div className="relative group">
                    <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-bible-muted group-focus-within:text-bible-accent transition-colors" size={28} />
                    <input
                      type="text"
                      placeholder="Busque por temas, palavras ou promessas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full pl-20 pr-40 py-8 bg-white border border-bible-border rounded-[2.5rem] text-xl font-serif focus:ring-8 focus:ring-bible-accent/5 focus:border-bible-accent/20 outline-none shadow-2xl transition-all"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                      className="absolute right-4 top-1/2 -translate-y-1/2 px-10 py-4 bg-bible-accent text-white rounded-[1.8rem] text-sm font-bold hover:bg-bible-accent/90 disabled:opacity-30 transition-all shadow-xl shadow-bible-accent/20"
                    >
                      {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Pesquisar"}
                    </button>
                  </div>
                  <p className="text-xs text-bible-muted font-medium italic">
                    Utilizando o índice completo da Bíblia Almeida para resultados instantâneos.
                  </p>
                </div>

                <div className="space-y-6">
                  {searchResults.map((result, idx) => (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      key={`${result.book}-${result.chapter}-${result.verse}`}
                      className="card-elegant p-8 hover:border-bible-accent/30 transition-all cursor-pointer group"
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
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-bible-accent/5 rounded-lg flex items-center justify-center text-bible-accent">
                            <Book size={14} />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-bible-accent">
                            {result.book} {result.chapter}:{result.verse}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-bible-border flex items-center justify-center text-bible-muted group-hover:bg-bible-accent group-hover:text-white group-hover:border-bible-accent transition-all">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="text-bible-ink/80 font-serif text-xl leading-relaxed">{result.text}</p>
                    </motion.div>
                  ))}

                  {searchResults.length === 0 && !isSearching && searchQuery && (
                    <div className="card-elegant p-20 text-center">
                      <Search size={48} className="text-bible-accent/10 mx-auto mb-6" />
                      <h3 className="text-2xl font-serif font-bold mb-2">Sem resultados</h3>
                      <p className="text-bible-muted">Não encontramos versículos com esses termos. Tente palavras sinônimas.</p>
                    </div>
                  )}

                  {!searchQuery && (
                    <div className="card-elegant p-20 text-center">
                      <Book size={48} className="text-bible-accent/10 mx-auto mb-6" />
                      <h3 className="text-2xl font-serif font-bold mb-2">Pronto para Explorar</h3>
                      <p className="text-bible-muted">Digite algo que esteja em seu coração para encontrar nas Escrituras.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "dashboard" && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-5xl mx-auto space-y-12"
              >
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-bible-muted">Sua Jornada de Fé</span>
                  <h2 className="text-5xl font-serif font-bold">Estatísticas</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { label: "Capítulos Lidos", value: readCount, sub: `de ${totalChapters} totais`, icon: BookOpen },
                    { label: "Conclusão", value: `${progressPercent}%`, sub: "da Bíblia Sagrada", icon: BarChart2 },
                    { label: "Reflexões", value: notes.length, sub: "notas no diário", icon: StickyNote }
                  ].map((stat, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      key={stat.label}
                      className="card-elegant p-10 relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-bible-accent/[0.03] rounded-bl-[4rem] transition-all group-hover:scale-110" />
                      <stat.icon className="text-bible-accent/20 mb-6" size={32} />
                      <div className="text-bible-muted text-[10px] font-bold uppercase tracking-widest mb-3">{stat.label}</div>
                      <div className="text-6xl font-serif font-bold text-bible-accent mb-2">{stat.value}</div>
                      <div className="text-xs font-medium text-bible-muted">{stat.sub}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="card-elegant p-12">
                  <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-bible-muted mb-10 flex items-center gap-3">
                    <BarChart2 size={14} />
                    Progresso por Seção
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
                    {CATEGORIES.map(cat => {
                      const catBooks = BIBLE_BOOKS.filter(b => b.category === cat);
                      const catTotal = catBooks.reduce((acc, b) => acc + b.chapters, 0);
                      const catRead = readChapters.filter(rc => catBooks.some(b => b.name === rc.book)).length;
                      const catPercent = Math.round((catRead / catTotal) * 100);

                      return (
                        <div key={cat} className="space-y-3">
                          <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-bible-ink/80">{cat}</span>
                            <span className="text-[10px] font-mono font-bold text-bible-accent">{catRead}/{catTotal}</span>
                          </div>
                          <div className="h-2.5 bg-bible-accent/5 rounded-full overflow-hidden p-0.5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${catPercent}%` }}
                              transition={{ duration: 1.5, ease: "circOut" }}
                              className="h-full bg-bible-accent rounded-full shadow-sm"
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
