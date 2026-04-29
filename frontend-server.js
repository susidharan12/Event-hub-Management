const express = require('express');
const path = require('path');
const app = express();

// Serve static files from frontend/Public directory
app.use(express.static(path.join(__dirname, 'frontend/Public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'backend/uploads')));

// Default route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// Organizer dashboard route
app.get('/organizer', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/Public/organizer/pages/dashboard.html'));
});

const PORT = process.env.FRONTEND_PORT || 8080;
app.listen(PORT, () => {
    console.log(`Frontend server running on http://localhost:${PORT}`);
    console.log(`Organizer Dashboard: http://localhost:${PORT}/organizer`);
});