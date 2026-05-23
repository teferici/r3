const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// folders
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('data')) fs.mkdirSync('data');

// DB
const db = new sqlite3.Database('./data/database.sqlite');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE,
            title TEXT,
            description TEXT,
            redirect_url TEXT,
            image TEXT
        )
    `);
});

// upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =========================
// SECRET ADMIN PAGE
// =========================
app.get('/a8f92k3m-admin', (req, res) => {

    db.all('SELECT * FROM posts ORDER BY id DESC', [], (err, rows) => {

        if (err) return res.send(err.message);

        res.send(`
            <h1>Admin Panel</h1>

            <form action="/create" method="POST" enctype="multipart/form-data">

                <input name="slug" placeholder="slug (example: iphone)" required><br><br>

                <input name="title" placeholder="title" required><br><br>

                <textarea name="description" placeholder="description"></textarea><br><br>

                <input name="redirect_url" placeholder="https://example.com" required><br><br>

                <input type="file" name="image" required><br><br>

                <button type="submit">Create Post</button>

            </form>

            <hr>

            <h2>Posts</h2>

            ${rows.map(p => `
                <div style="margin-bottom:10px;">
                    <b>${p.slug}</b><br>
                    ${p.redirect_url}<br>
                    <a href="/${p.slug}" target="_blank">Open</a>
                </div>
            `).join('')}

        `);
    });
});

// =========================
// CREATE POST
// =========================
app.post('/create', upload.single('image'), (req, res) => {

    const { slug, title, description, redirect_url } = req.body;

    const image = req.file
        ? `/uploads/${req.file.filename}`
        : '';

    db.run(
        `INSERT INTO posts (slug, title, description, redirect_url, image)
         VALUES (?, ?, ?, ?, ?)`,
        [slug, title, description, redirect_url, image],
        () => {
            res.redirect('/a8f92k3m-admin');
        }
    );
});

// =========================
// PUBLIC REDIRECT PAGE
// =========================
app.get('/:slug', (req, res) => {

    const slug = req.params.slug;

    db.get(
        'SELECT * FROM posts WHERE slug = ?',
        [slug],
        (err, row) => {

            if (!row) return res.status(404).send('Not found');

            const fullImage =
                `${req.protocol}://${req.get('host')}${row.image}`;

            res.send(`
                <html>
                <head>

                    <title>${row.title}</title>

                    <meta property="og:title" content="${row.title}">
                    <meta property="og:description" content="${row.description}">
                    <meta property="og:image" content="${fullImage}">
                    <meta property="og:type" content="website">

                    <meta name="twitter:card" content="summary_large_image">

                    <meta http-equiv="refresh" content="1;url=${row.redirect_url}">

                    <style>
                        body { font-family: Arial; text-align:center; padding:40px; }
                        img { max-width:400px; border-radius:10px; }
                    </style>

                </head>

                <body>
                    <h1>${row.title}</h1>
                    <p>${row.description}</p>
                    <img src="${fullImage}">
                    <p>Redirecting...</p>
                </body>
                </html>
            `);
        }
    );
});

// =========================
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
