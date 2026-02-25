import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("bible.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS read_chapters (
    book TEXT,
    chapter INTEGER,
    PRIMARY KEY (book, chapter)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book TEXT,
    chapter INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book TEXT,
    chapter INTEGER,
    verse INTEGER,
    text TEXT
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS verses_search USING fts5(
    book,
    chapter UNINDEXED,
    verse UNINDEXED,
    text,
    content='verses',
    content_rowid='id'
  );

  -- Triggers to keep FTS index in sync
  CREATE TRIGGER IF NOT EXISTS verses_ai AFTER INSERT ON verses BEGIN
    INSERT INTO verses_search(rowid, book, chapter, verse, text) VALUES (new.id, new.book, new.chapter, new.verse, new.text);
  END;
`);

let isImporting = false;
let importProgress = 0;

async function importBible() {
  try {
    const count = db.prepare("SELECT COUNT(*) as count FROM verses").get() as { count: number };
    if (count.count > 0) return;

    isImporting = true;
    console.log("Importing Bible data...");
    const response = await fetch("https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_aa.json");
    const data = await response.json() as any[];
    
    const insert = db.prepare("INSERT INTO verses (book, chapter, verse, text) VALUES (?, ?, ?, ?)");
    
    db.transaction(() => {
      for (let i = 0; i < data.length; i++) {
        const book = data[i];
        book.chapters.forEach((chapter: string[], chapterIdx: number) => {
          chapter.forEach((verseText: string, verseIdx: number) => {
            insert.run(book.name, chapterIdx + 1, verseIdx + 1, verseText);
          });
        });
        importProgress = Math.round(((i + 1) / data.length) * 100);
      }
    })();
    console.log("Bible import complete!");
  } catch (error) {
    console.error("Failed to import Bible:", error);
  } finally {
    isImporting = false;
  }
}

export async function createExpressApp() {
  importBible(); // Don't await
  const app = express();

  app.use(express.json());

  // API Routes
  app.get("/api/bible/status", (req, res) => {
    try {
      const count = db.prepare("SELECT COUNT(*) as count FROM verses").get() as { count: number };
      res.json({ isImporting, progress: importProgress, totalVerses: count.count });
    } catch (e) {
      res.json({ isImporting: false, progress: 0, totalVerses: 0 });
    }
  });

  app.get("/api/progress", (req, res) => {
    const rows = db.prepare("SELECT book, chapter FROM read_chapters").all();
    res.json(rows);
  });

  app.post("/api/read", (req, res) => {
    const { book, chapter, read } = req.body;
    if (read) {
      db.prepare("INSERT OR IGNORE INTO read_chapters (book, chapter) VALUES (?, ?)").run(book, chapter);
    } else {
      db.prepare("DELETE FROM read_chapters WHERE book = ? AND chapter = ?").run(book, chapter);
    }
    res.json({ success: true });
  });

  app.get("/api/notes", (req, res) => {
    const { q } = req.query;
    let rows;
    if (q) {
      rows = db.prepare("SELECT * FROM notes WHERE content LIKE ? ORDER BY created_at DESC").all(`%${q}%`);
    } else {
      rows = db.prepare("SELECT * FROM notes ORDER BY created_at DESC").all();
    }
    res.json(rows);
  });

  app.post("/api/notes", (req, res) => {
    const { book, chapter, content } = req.body;
    const result = db.prepare("INSERT INTO notes (book, chapter, content) VALUES (?, ?, ?)").run(book, chapter, content);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/notes/:id", (req, res) => {
    db.prepare("DELETE FROM notes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/bible/:book/:chapter", (req, res) => {
    const { book, chapter } = req.params;
    const rows = db.prepare("SELECT verse, text FROM verses WHERE book = ? AND chapter = ? ORDER BY verse").all(book, chapter);
    res.json(rows);
  });

  app.get("/api/bible/search", (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    
    try {
      const rows = db.prepare(`
        SELECT book, chapter, verse, text 
        FROM verses_search 
        WHERE text MATCH ? 
        LIMIT 100
      `).all(q);
      res.json(rows);
    } catch (e) {
      res.json([]);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const PORT = parseInt(process.env.PORT || "3000", 10);
  createExpressApp().then(app => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}
