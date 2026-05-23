const express = require('express');

    next();
}

// Admin page
app.get('/admin', checkAuth, (req, res) => {
    db.all('SELECT * FROM posts ORDER BY id DESC', [], (err, rows) => {
        res.render('admin', { posts: rows });
    });
});

// Create post
app.post('/create', checkAuth, upload.single('image'), (req, res) => {

    const {
        slug,
        title,
        description,
        redirect_url
    } = req.body;

    const image = req.file ? `/uploads/${req.file.filename}` : '';

    db.run(
        `INSERT INTO posts (slug, title, description, redirect_url, image)
         VALUES (?, ?, ?, ?, ?)`,
        [slug, title, description, redirect_url, image],
        (err) => {
            if (err) {
                return res.send('Error: ' + err.message);
            }

            res.redirect('/admin');
        }
    );
});

// Redirect route
app.get('/:slug', (req, res) => {

    const slug = req.params.slug;

    db.get(
        'SELECT * FROM posts WHERE slug = ?',
        [slug],
        (err, row) => {

            if (!row) {
                return res.status(404).send('Post not found');
            }

            const fullImage = `${req.protocol}://${req.get('host')}${row.image}`;

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
