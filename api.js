const http = require('http');
const { userDB } = require('./database');

const PORT = process.env.PORT || 3000;

// Simple HTTP server for authentication API
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Login endpoint
  if (req.url === '/api/login' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Username and password required' }));
          return;
        }

        const result = userDB.authenticate(username, password);

        if (!result) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Invalid username or password' }));
          return;
        }

        if (result.expired) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Your subscription has expired' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Login successful',
          user: {
            username: result.user.username,
            expiryDate: result.user.expiry_date
          }
        }));
      } catch (error) {
        console.error(error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
    });
    return;
  }

  // Health check
  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Save config endpoint
  if (req.url === '/api/save-config' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { username, password, configs } = JSON.parse(body);
        
        if (!username || !password || !configs) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Missing required fields' }));
          return;
        }

        const result = userDB.authenticate(username, password);

        if (!result || result.expired) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
          return;
        }

        // Save configs to user
        userDB.saveConfigs(username, configs);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Config saved' }));
      } catch (error) {
        console.error(error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
    });
    return;
  }

  // Get active config endpoint
  if (req.url.startsWith('/api/get-config?') && req.method === 'GET') {
    try {
      const urlParams = new URLSearchParams(req.url.split('?')[1]);
      const username = urlParams.get('username');

      if (!username) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('-- Error: Missing username parameter');
        return;
      }

      const configs = userDB.getConfigs(username);

      if (!configs) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('-- No configs found for user: ' + username + '\n-- Please login to the website and create a config');
        return;
      }

      // Find active config
      let activeCode = null;
      for (const [name, config] of Object.entries(configs)) {
        if (config.active) {
          activeCode = config.code;
          break;
        }
      }

      if (!activeCode) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('-- No active config for user: ' + username + '\n-- Please activate a config in the Config Editor');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(activeCode);
    } catch (error) {
      console.error(error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('-- Server error');
    }
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`🌐 API server running on http://localhost:${PORT}`);
});
