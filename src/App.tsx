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

    // Check import status
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

  // Fetch Bible text when book or chapter changes
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

  // Scroll to highlighted verse
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

  const filteredNotes = notes; // Already filtered by server if query exists

  return (
    <div className="flex h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans overflow-hidden">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-full shadow-md"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-72 bg-white border-r border-black/5 flex flex-col h-full z-40"
          >
            <div className="p-6 border-bottom border-black/5">
              <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
                <Book className="text-[#5A5A40]" />
                Bíblia Digital
              </h1>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-6">
              {CATEGORIES.map(category => (
                <div key={category}>
                  <h3 className="text-[10px] uppercase tracking-widest font-semibold text-black/40 mb-3 px-2">
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
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                          selectedBook?.id === book.id 
                            ? "bg-[#5A5A40] text-white" 
                            : "hover:bg-black/5"
                        }`}
                      >
                        <span>{book.name}</span>
                        <ChevronRight size={14} className={selectedBook?.id === book.id ? "opacity-100" : "opacity-0 group-hover:opacity-50"} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-black/5 bg-black/5">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span>Progresso Total</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-[#5A5A40]"
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
          <div className="bg-[#5A5A40] text-white px-4 py-1 text-[10px] font-bold uppercase tracking-widest flex items-center justify-between">
            <span>Importando Bíblia... {importStatus.progress}%</span>
            <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${importStatus.progress}%` }} />
            </div>
          </div>
        )}

        {/* Header Tabs */}
        <header className="h-16 bg-white border-b border-black/5 flex items-center px-6 gap-8">
          <button 
            onClick={() => setActiveTab("read")}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === "read" ? "text-[#5A5A40]" : "text-black/40 hover:text-black"}`}
          >
            <BookOpen size={18} />
            Leitura
          </button>
          <button 
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === "notes" ? "text-[#5A5A40]" : "text-black/40 hover:text-black"}`}
          >
            <StickyNote size={18} />
            Notas
          </button>
          <button 
            onClick={() => setActiveTab("search")}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === "search" ? "text-[#5A5A40]" : "text-black/40 hover:text-black"}`}
          >
            <Search size={18} />
            Pesquisa
          </button>
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === "dashboard" ? "text-[#5A5A40]" : "text-black/40 hover:text-black"}`}
          >
            <BarChart2 size={18} />
            Estatísticas
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-12">
          {activeTab === "read" && (
            <div className="max-w-3xl mx-auto">
              {!selectedBook ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <BookOpen size={48} className="text-black/10 mb-4" />
                  <h2 className="text-2xl font-serif font-bold mb-2">Selecione um livro</h2>
                  <p className="text-black/40">Comece sua jornada de leitura escolhendo um livro na barra lateral.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                      <h2 className="text-4xl font-serif font-bold mb-2">{selectedBook.name}</h2>
                      <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                        {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(ch => (
                          <button
                            key={ch}
                            onClick={() => {
                              setSelectedChapter(ch);
                              setHighlightedVerse(null);
                            }}
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                              selectedChapter === ch 
                                ? "bg-[#5A5A40] text-white shadow-lg" 
                                : readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === ch)
                                  ? "bg-[#5A5A40]/10 text-[#5A5A40] border border-[#5A5A40]/20"
                                  : "bg-white border border-black/5 hover:border-black/20"
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleRead(selectedBook.name, selectedChapter)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all shadow-sm ${
                        readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === selectedChapter)
                          ? "bg-[#5A5A40] text-white"
                          : "bg-white border-2 border-[#5A5A40]/20 text-[#5A5A40] hover:border-[#5A5A40]/40"
                      }`}
                    >
                      <CheckCircle size={18} />
                      {readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === selectedChapter) ? "Lido" : "Marcar como lido"}
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl p-8 lg:p-12 shadow-sm border border-black/5 min-h-[400px]">
                    {isLoading ? (
                      <div className="h-full flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-[#5A5A40]" size={32} />
                      </div>
                    ) : (
                      <div className="prose prose-stone max-w-none">
                        <h3 className="text-xl font-serif italic text-black/40 mb-8 border-b border-black/5 pb-4">
                          Capítulo {selectedChapter}
                        </h3>
                        <div className="space-y-6">
                          {bibleText.map(verse => (
                            <p 
                              key={verse.verse} 
                              id={`verse-${verse.verse}`}
                              className={`leading-relaxed text-lg transition-all duration-700 p-2 rounded-xl ${
                                highlightedVerse === verse.verse 
                                  ? "bg-[#5A5A40]/10 ring-1 ring-[#5A5A40]/20 shadow-sm" 
                                  : ""
                              }`}
                            >
                              <sup className="text-[10px] font-bold text-[#5A5A40] mr-2 uppercase tracking-tighter">
                                {verse.verse}
                              </sup>
                              {verse.text}
                            </p>
                          ))}
                        </div>

                        <div className="mt-12 pt-8 border-t border-black/5 flex justify-center">
                          <button
                            onClick={() => toggleRead(selectedBook.name, selectedChapter)}
                            className={`flex items-center gap-3 px-8 py-4 rounded-full text-base font-bold transition-all shadow-sm hover:shadow-md ${
                              readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === selectedChapter)
                                ? "bg-[#5A5A40] text-white"
                                : "bg-white border-2 border-[#5A5A40]/20 text-[#5A5A40] hover:border-[#5A5A40]/40"
                            }`}
                          >
                            <CheckCircle size={20} />
                            {readChapters.some(rc => rc.book === selectedBook.name && rc.chapter === selectedChapter) ? "Capítulo Concluído" : "Marcar Capítulo como Lido"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Note for current chapter */}
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-black/40 mb-4">Adicionar Nota</h4>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder={`O que você aprendeu em ${selectedBook.name} ${selectedChapter}?`}
                      className="w-full h-32 p-4 bg-[#F5F2ED] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 resize-none mb-4"
                    />
                    <button
                      onClick={addNote}
                      disabled={!noteContent.trim()}
                      className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-full text-sm font-semibold hover:bg-[#4A4A30] disabled:opacity-50 transition-colors"
                    >
                      <Plus size={18} />
                      Salvar Nota
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-serif font-bold">Minhas Notas</h2>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={18} />
                  <input
                    type="text"
                    placeholder="Pesquisar notas..."
                    value={noteSearch}
                    onChange={(e) => {
                      setNoteSearch(e.target.value);
                      fetchNotes(e.target.value);
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-black/5 rounded-full text-sm focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredNotes.map(note => (
                  <motion.div 
                    layout
                    key={note.id}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] bg-[#5A5A40]/5 px-3 py-1 rounded-full">
                        {note.book} {note.chapter}
                      </span>
                      <button 
                        onClick={() => deleteNote(note.id)}
                        className="text-black/20 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-black/70 leading-relaxed mb-4">{note.content}</p>
                    <div className="text-[10px] text-black/30 font-medium">
                      {new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </motion.div>
                ))}
                {filteredNotes.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <StickyNote size={48} className="text-black/10 mx-auto mb-4" />
                    <p className="text-black/40">Nenhuma nota encontrada.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "search" && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl font-serif font-bold">Pesquisar na Bíblia</h2>
                <div className="relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-black/20" size={24} />
                  <input
                    type="text"
                    placeholder="Digite uma palavra ou frase (ex: 'amor', 'fé', 'Jesus')..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    className="w-full pl-16 pr-32 py-6 bg-white border border-black/5 rounded-3xl text-lg focus:ring-2 focus:ring-[#5A5A40]/20 outline-none shadow-sm"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="absolute right-4 top-1/2 -translate-y-1/2 px-6 py-2 bg-[#5A5A40] text-white rounded-full text-sm font-semibold hover:bg-[#4A4A30] disabled:opacity-50 transition-colors"
                  >
                    {isSearching ? <Loader2 className="animate-spin" size={18} /> : "Buscar"}
                  </button>
                </div>
                <p className="text-xs text-black/40 px-4 italic">
                  A pesquisa utiliza o índice local da Bíblia Almeida para encontrar versículos específicos instantaneamente.
                </p>
              </div>

              <div className="space-y-4">
                {searchResults.map((result, idx) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={`${result.book}-${result.chapter}-${result.verse}`}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 hover:border-[#5A5A40]/30 transition-colors cursor-pointer"
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
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">
                        {result.book} {result.chapter}:{result.verse}
                      </span>
                      <ChevronRight size={14} className="text-black/20" />
                    </div>
                    <p className="text-black/70 leading-relaxed">{result.text}</p>
                  </motion.div>
                ))}

                {searchResults.length === 0 && !isSearching && searchQuery && (
                  <div className="bg-white rounded-3xl p-12 shadow-sm border border-black/5 text-center">
                    <Search size={48} className="text-black/10 mx-auto mb-4" />
                    <h3 className="text-xl font-serif font-bold mb-2">Nenhum resultado encontrado</h3>
                    <p className="text-black/40 max-w-md mx-auto">
                      Tente usar palavras diferentes ou verifique a ortografia.
                    </p>
                  </div>
                )}

                {!searchQuery && (
                  <div className="bg-white rounded-3xl p-12 shadow-sm border border-black/5 text-center">
                    <Book size={48} className="text-black/10 mx-auto mb-4" />
                    <h3 className="text-xl font-serif font-bold mb-2">Pronto para pesquisar</h3>
                    <p className="text-black/40 max-w-md mx-auto">
                      Pesquise por qualquer palavra ou tema em toda a Bíblia Sagrada.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "dashboard" && (
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl font-serif font-bold">Seu Progresso</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                  <div className="text-black/40 text-[10px] font-bold uppercase tracking-widest mb-2">Capítulos Lidos</div>
                  <div className="text-5xl font-serif font-bold text-[#5A5A40]">{readCount}</div>
                  <div className="text-xs text-black/30 mt-2">de {totalChapters} totais</div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                  <div className="text-black/40 text-[10px] font-bold uppercase tracking-widest mb-2">Conclusão</div>
                  <div className="text-5xl font-serif font-bold text-[#5A5A40]">{progressPercent}%</div>
                  <div className="text-xs text-black/30 mt-2">da Bíblia completa</div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                  <div className="text-black/40 text-[10px] font-bold uppercase tracking-widest mb-2">Notas Criadas</div>
                  <div className="text-5xl font-serif font-bold text-[#5A5A40]">{notes.length}</div>
                  <div className="text-xs text-black/30 mt-2">reflexões pessoais</div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                <h3 className="text-sm font-bold uppercase tracking-widest text-black/40 mb-6">Progresso por Categoria</h3>
                <div className="space-y-6">
                  {CATEGORIES.map(cat => {
                    const catBooks = BIBLE_BOOKS.filter(b => b.category === cat);
                    const catTotal = catBooks.reduce((acc, b) => acc + b.chapters, 0);
                    const catRead = readChapters.filter(rc => catBooks.some(b => b.name === rc.book)).length;
                    const catPercent = Math.round((catRead / catTotal) * 100);

                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                          <span>{cat}</span>
                          <span className="text-black/40">{catRead}/{catTotal} ({catPercent}%)</span>
                        </div>
                        <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${catPercent}%` }}
                            className="h-full bg-[#5A5A40]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
