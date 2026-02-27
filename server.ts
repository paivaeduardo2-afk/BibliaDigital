import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = "bible-app-jwt-secret-key-2026";
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

// Migration helper for read_chapters
const tableInfo = db.prepare("PRAGMA table_info(read_chapters)").all() as any[];
if (tableInfo.length === 0) {
  // Table doesn't exist, create it
  db.exec(`
    CREATE TABLE read_chapters (
      user_id INTEGER,
      book TEXT,
      chapter INTEGER,
      PRIMARY KEY (user_id, book, chapter),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
} else {
  // Table exists, check if it has user_id in PK
  const pkColumns = tableInfo.filter(c => c.pk > 0);
  const hasUserIdInPk = pkColumns.some(c => c.name === 'user_id');
  
  if (!hasUserIdInPk) {
    console.log("Migrating read_chapters table...");
    db.transaction(() => {
      db.exec("ALTER TABLE read_chapters RENAME TO old_read_chapters");
      db.exec(`
        CREATE TABLE read_chapters (
          user_id INTEGER,
          book TEXT,
          chapter INTEGER,
          PRIMARY KEY (user_id, book, chapter),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);
      // Try to migrate data, assuming user_id might be null or missing
      try {
        db.exec("INSERT INTO read_chapters (user_id, book, chapter) SELECT user_id, book, chapter FROM old_read_chapters WHERE user_id IS NOT NULL");
      } catch (e) {
        console.log("Could not migrate old read_chapters data, starting fresh.");
      }
      db.exec("DROP TABLE old_read_chapters");
    })();
  }
}

// Migration helper for notes
const notesInfo = db.prepare("PRAGMA table_info(notes)").all() as any[];
if (notesInfo.length === 0) {
  db.exec(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      book TEXT,
      chapter INTEGER,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
} else {
  const hasUserId = notesInfo.some(c => c.name === 'user_id');
  if (!hasUserId) {
    console.log("Migrating notes table...");
    db.transaction(() => {
      db.exec("ALTER TABLE notes RENAME TO old_notes");
      db.exec(`
        CREATE TABLE notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          book TEXT,
          chapter INTEGER,
          content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);
      db.exec("DROP TABLE old_notes");
    })();
  }
}

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

  app.set("trust proxy", true);
  app.use(express.json());
  
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[${req.method}] ${req.path} - Status: ${res.statusCode} - User: ${(req as any).user?.id || 'none'} - Time: ${Date.now() - start}ms`);
    });
    next();
  });

  // JWT Middleware
  app.use((req: any, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
      } catch (e) {
        console.warn("Invalid token");
      }
    }
    next();
  });

  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hashedPassword);
      const userId = result.lastInsertRowid as number;
      const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: "30d" });
      res.json({ id: userId, username, token });
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
    console.log(`Login attempt for: ${username}`);
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
      console.log(`[Login] Successful for ${username}. Token issued.`);
      res.json({ id: user.id, username: user.username, token });
    } else {
      console.log(`Login failed for: ${username}`);
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true });
  });

  app.get("/api/auth/me", (req: any, res) => {
    if (req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // Middleware to check auth
  const requireAuth = (req: any, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
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

  app.get("/api/progress", requireAuth, (req: any, res) => {
    console.log(`Fetching progress for user: ${req.user.id}`);
    try {
      const rows = db.prepare("SELECT book, chapter FROM read_chapters WHERE user_id = ?").all(req.user.id);
      res.json(rows);
    } catch (e) {
      console.error("Error fetching progress:", e);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  app.post("/api/read", requireAuth, (req: any, res) => {
    const { book, chapter, read } = req.body;
    if (!book || typeof chapter !== 'number') {
      return res.status(400).json({ error: "Invalid book or chapter" });
    }
    const cleanBook = book.trim();
    const userId = req.user.id;
    
    try {
      if (read) {
        db.prepare("INSERT OR IGNORE INTO read_chapters (user_id, book, chapter) VALUES (?, ?, ?)").run(userId, cleanBook, chapter);
      } else {
        db.prepare("DELETE FROM read_chapters WHERE user_id = ? AND book = ? AND chapter = ?").run(userId, cleanBook, chapter);
      }
      res.json({ success: true });
    } catch (e) {
      console.error("Error updating progress:", e);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });

  app.get("/api/notes", requireAuth, (req: any, res) => {
    const { q } = req.query;
    const userId = req.user.id;
    let rows;
    if (q) {
      rows = db.prepare("SELECT * FROM notes WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC").all(userId, `%${q}%`);
    } else {
      rows = db.prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    }
    res.json(rows);
  });

  app.post("/api/notes", requireAuth, (req: any, res) => {
    const { book, chapter, content } = req.body;
    const userId = req.user.id;
    const result = db.prepare("INSERT INTO notes (user_id, book, chapter, content) VALUES (?, ?, ?, ?)").run(userId, book, chapter, content);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/notes/:id", requireAuth, (req: any, res) => {
    const userId = req.user.id;
    db.prepare("DELETE FROM notes WHERE id = ? AND user_id = ?").run(req.params.id, userId);
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
    app.use(express.static(path.join(__dirname, "dist"), {
      maxAge: '1d',
      etag: true
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const PORT = parseInt(process.env.PORT || "3000", 10);
  createExpressApp().then(app => {
    app.get("/api/debug/books", (req, res) => {
    const rows = db.prepare("SELECT DISTINCT book FROM verses").all();
    res.json(rows);
  });

  app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}
