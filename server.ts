import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("bible.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS read_chapters (
    user_id INTEGER,
    book TEXT,
    chapter INTEGER,
    PRIMARY KEY (user_id, book, chapter),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    book TEXT,
    chapter INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
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

// Add user_id column to existing tables if they don't have it (migration helper)
try {
  db.exec("ALTER TABLE read_chapters ADD COLUMN user_id INTEGER REFERENCES users(id)");
} catch (e) {}
try {
  db.exec("ALTER TABLE notes ADD COLUMN user_id INTEGER REFERENCES users(id)");
} catch (e) {}

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

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
  }
}

export async function createExpressApp() {
  importBible(); // Don't await
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: "bible-app-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hashedPassword);
      req.session.userId = result.lastInsertRowid as number;
      req.session.username = username;
      res.json({ id: req.session.userId, username });
    } catch (e: any) {
      if (e.code === "SQLITE_CONSTRAINT") {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ id: user.id, username: user.username });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session.userId) {
      res.json({ id: req.session.userId, username: req.session.username });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // Middleware to check auth
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.session.userId) return res.status(401).json({ error: "Authentication required" });
    next();
  };

  // API Routes
  app.get("/api/bible/status", (req, res) => {
    try {
      const count = db.prepare("SELECT COUNT(*) as count FROM verses").get() as { count: number };
      res.json({ isImporting, progress: importProgress, totalVerses: count.count });
    } catch (e) {
      res.json({ isImporting: false, progress: 0, totalVerses: 0 });
    }
  });

  app.get("/api/progress", requireAuth, (req, res) => {
    const rows = db.prepare("SELECT book, chapter FROM read_chapters WHERE user_id = ?").all(req.session.userId);
    res.json(rows);
  });

  app.post("/api/read", requireAuth, (req, res) => {
    const { book, chapter, read } = req.body;
    if (read) {
      db.prepare("INSERT OR IGNORE INTO read_chapters (user_id, book, chapter) VALUES (?, ?, ?)").run(req.session.userId, book, chapter);
    } else {
      db.prepare("DELETE FROM read_chapters WHERE user_id = ? AND book = ? AND chapter = ?").run(req.session.userId, book, chapter);
    }
    res.json({ success: true });
  });

  app.get("/api/notes", requireAuth, (req, res) => {
    const { q } = req.query;
    let rows;
    if (q) {
      rows = db.prepare("SELECT * FROM notes WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC").all(req.session.userId, `%${q}%`);
    } else {
      rows = db.prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC").all(req.session.userId);
    }
    res.json(rows);
  });

  app.post("/api/notes", requireAuth, (req, res) => {
    const { book, chapter, content } = req.body;
    const result = db.prepare("INSERT INTO notes (user_id, book, chapter, content) VALUES (?, ?, ?, ?)").run(req.session.userId, book, chapter, content);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/notes/:id", requireAuth, (req, res) => {
    db.prepare("DELETE FROM notes WHERE id = ? AND user_id = ?").run(req.params.id, req.session.userId);
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
