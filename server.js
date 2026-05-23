const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure folders exist
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('data')) fs.mkdirSync('data');

// Database
const db = new sqlite3.Database('./data/database.sqlite');

// Create table
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

// Password protection
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

function checkAuth(req, res, next) {

    const password =
        req.query.password ||
        req.headers['x-admin-password'];

    if (password !== ADMIN_PASSWORD) {

        return res.status(401).send(`
            <h2>Unauthorized</h2>
            <p>Add ?password=YOUR_PASSWORD to the URL.</p>
        `);
    }

    next();
}

// Upload config
const storage = multer.diskStorage({

    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },

    filename: function(req, file, cb) {

        const unique =
            Date.now() + '-' + file.originalname;

        cb(null, unique);
    }
});

const upload = multer({ storage });

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(
    '/uploads',
    express.static(path.join(__dirname, 'uploads'))
);

app.use(
    '/public',
    express.static(path.join(__dirname, 'public'))
);

// Admin page
app.get('/admin', checkAuth, (req, res) => {

    db.all(
        'SELECT * FROM posts ORDER BY id DESC',
        [],
        (err, rows) => {

            if (err) {
                return res.send(err.message);
            }

            res.render('admin', {
                posts: rows
            });
        }
    );
});

// Create post
app.post(
    '/create',
    checkAuth,
    upload.single('image'),
    (req, res) => {

        const {
            slug,
            title,
            description,
            redirect_url
        } = req.body;

        const image =
            req.file
                ? `/uploads/${req.file.filename}`
                : '';

        db.run(
            `
            INSERT INTO posts
            (
                slug,
                title,
                description,
                redirect_url,
                image
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                slug,
                title,
                description,
                redirect_url,
                image
            ],
            (err) => {

                if (err) {
                    return res.send(
                        'Error: ' + err.message
                    );
                }

                res.redirect(
                    '/admin?password=' + ADMIN_PASSWORD
                );
            }
        );
    }
);

// Redirect route
app.get('/:slug', (req, res) => {

    const slug = req.params.slug;

    db.get(
        'SELECT * FROM posts WHERE slug = ?',
        [slug],
        (err, row) => {

            if (err) {
                return res.send(err.message);
            }

            if (!row) {
                return res
                    .status(404)
                    .send('Post not found');
            }

            const fullImage =
                `${req.protocol}://${req.get('host')}${row.image}`;

            res.render('redirect', {
                post: row,
                fullImage
            });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
