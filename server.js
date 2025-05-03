const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// API key
const API_KEY = 'd860911ad19af07b8e7585a949df76edd0cf80afc86f93077a6697535ad472eb';

// Enable CORS
app.use(cors());

// Parse JSON request body
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Middleware to verify auth status
const checkAuth = (req, res, next) => {
  // In development mode, we'll allow requests without a userId
  // In a production environment, you would verify the Firebase ID token here
  if (process.env.NODE_ENV === 'production') {
    if (!req.body.userId && !req.query.userId) {
      return res.status(401).json({
        error: 'Authentication required',
        details: 'User must be authenticated to use this service'
      });
    }
  }
  next();
};

// Proxy endpoint for Zero2Launch text generation API
app.post('/api/generate-text', checkAuth, async (req, res) => {
  try {
    // Forward the request to Zero2Launch API
    const response = await axios({
      method: 'POST',
      url: 'https://api.zero2launch.com/generate-text',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      data: req.body
    });

    // Return the API response
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying text request:', error.message);
    
    // Forward error details
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      res.status(error.response.status).json({
        error: 'API Error',
        details: error.response.data,
        status: error.response.status
      });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(500).json({
        error: 'No response from API server',
        details: 'The request was made but no response was received'
      });
    } else {
      // Something happened in setting up the request
      res.status(500).json({
        error: 'Request setup error',
        details: error.message
      });
    }
  }
});

// Proxy endpoint for Zero2Launch text-to-audio API
app.post('/api/generate-audio', checkAuth, async (req, res) => {
  try {
    console.log("Audio request received:", req.body);
    
    // Forward the request to Zero2Launch Audio API
    const response = await axios({
      method: 'POST',
      url: 'https://api.zero2launch.com/generate-audio/generate',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      data: req.body,
      responseType: 'arraybuffer' // Important for binary audio data
    });

    console.log("Audio API response received, content-type:", response.headers['content-type']);
    
    // Set appropriate headers for audio response
    const contentType = response.headers['content-type'] || 'audio/mpeg';
    res.set({
      'Content-Type': contentType,
      'Content-Length': response.data.length
    });

    // Return binary audio data
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying audio request:', error.message);
    
    // Forward error details
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      res.status(error.response.status).json({
        error: 'Audio API Error',
        details: error.response.data,
        status: error.response.status
      });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(500).json({
        error: 'No response from Audio API server',
        details: 'The request was made but no response was received'
      });
    } else {
      // Something happened in setting up the request
      res.status(500).json({
        error: 'Audio request setup error',
        details: error.message
      });
    }
  }
});

// Add the image generation endpoint after the audio endpoint
// Proxy endpoint for Zero2Launch image generation API
app.post('/api/generate-image', checkAuth, async (req, res) => {
  try {
    console.log("Image generation request received:", req.body);
    
    // Forward the request to Zero2Launch Image API
    const response = await axios({
      method: 'POST',
      url: 'https://api.zero2launch.com/download-image/data',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      data: req.body,
      responseType: 'arraybuffer' // Important for binary image data
    });

    console.log("Image API response received, content-type:", response.headers['content-type']);
    
    // Set appropriate headers for image response
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set({
      'Content-Type': contentType,
      'Content-Length': response.data.length
    });

    // Return binary image data
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying image request:', error.message);
    
    // Forward error details
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      res.status(error.response.status).json({
        error: 'Image API Error',
        details: error.response.data,
        status: error.response.status
      });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(500).json({
        error: 'No response from Image API server',
        details: 'The request was made but no response was received'
      });
    } else {
      // Something happened in setting up the request
      res.status(500).json({
        error: 'Image request setup error',
        details: error.message
      });
    }
  }
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 