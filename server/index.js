require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/crops',  require('./routes/crops'));
app.use('/api/regals', require('./routes/regals'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/profitability', require('./routes/profitability'));
app.use('/api/trays',    require('./routes/trays'));
app.use('/api/seeds',    require('./routes/seeds'));
app.use('/api/harvests', require('./routes/harvests'));
app.use('/api/ai',       require('./routes/ai'));

// Serve React client in production / Electron
const CLIENT_DIST = path.join(__dirname, '../client/dist');
app.use(express.static(CLIENT_DIST));
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

const PORT = process.env.PORT || 3001;
const serverReady = new Promise(resolve => {
  app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); resolve(); });
});
module.exports = { serverReady };
