const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Test API endpoints
solutions = [
  {
    id: '1',
    name: 'API Test - Static Server',
    description: 'Simple static server for testing only'
  }
];

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/', (req, res) => {
  res.status(200).json(solutions);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Static test server running on port ${port}`);
});
