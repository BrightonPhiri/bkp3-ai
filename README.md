# Zero2Launch AI Assistant

A beautiful web-based chat interface for interacting with the Zero2Launch AI API using jQuery.

## Features

- Modern chat interface with beautiful styling
- Multiple AI services in one interface:
  - Text Generation: Get intelligent text responses to your queries
  - Text-to-Audio: Convert your text into natural-sounding speech
  - Image Generation: Create AI-generated images from text descriptions
- Customizable voice options with different voices and vibes
- Image generation controls (size, model, seed)
- Audio playback controls directly in the chat interface
- Thinking animation while waiting for responses
- Support for code block formatting in responses
- Conversation history for context
- Customizable system prompt
- Responsive design that works on mobile and desktop
- Node.js proxy server to bypass CORS restrictions

## How to Run the Application

### Setting Up the Proxy Server (Recommended)

To handle CORS issues and protect your API key, use the included Node.js proxy server:

1. Install [Node.js](https://nodejs.org/) if you don't have it already
2. Open a terminal/command prompt in the project directory
3. Install dependencies:
   ```
   npm install
   ```
4. Start the server:
   ```
   npm start
   ```
5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

The proxy server handles API calls to Zero2Launch on behalf of your browser, avoiding CORS issues.

### Running Locally (Demo Mode)

If you don't want to use the proxy server, you can still run in demo mode:

1. Simply open the `index.html` file in your web browser
2. The app will automatically detect that it's running locally and switch to demo mode
3. In demo mode, you'll get simulated responses instead of real API calls
4. This mode is perfect for testing the interface before deploying

## Using the AI Services

### Text Generation
1. Select "Text AI" from the dropdown menu
2. Type your message and press Send
3. View the AI's text response in the chat

### Text-to-Audio
1. Select "Text-to-Audio" from the dropdown menu
2. Type the text you want to convert to speech
3. (Optional) Click "Voice Settings" to customize the voice and vibe
4. Press Send
5. Play the generated audio directly in the chat interface

### Image Generation
1. Select "Image Gen" from the dropdown menu
2. Type a detailed description of the image you want
3. (Optional) Click "Image Settings" to customize:
   - Model: Choose between different image generation models
   - Dimensions: Select width and height for your image
   - Seed: Set a specific seed for reproducible results
   - Number of Images: Generate 1, 2, or 4 images at once
4. Press Send
5. View the generated image(s) directly in the chat

## Customizing Voices

You can customize the voice used for text-to-audio:

1. Click the "Voice Settings" button
2. Select a voice from the dropdown:
   - Alloy: Balanced, neutral voice
   - Echo: Warm, deep voice
   - Fable: Expressive, dynamic voice
   - Onyx: Deep, authoritative voice
   - Nova: Friendly, approachable voice
   - Shimmer: Bright, cheerful voice

3. Select a vibe/style:
   - Default: Standard speaking style
   - Enthusiastic: Energetic and lively
   - Friendly: Warm and approachable
   - Sad: Somber and melancholic
   - Serious: Formal and authoritative
   - Excited: Highly energetic and animated

## Customizing Image Generation

You can customize the image generation process:

1. Click the "Image Settings" button when in Image Gen mode
2. Choose from different models:
   - Flux: Default model for general purpose images
   - Stable Diffusion: Alternative image generation model
   - DALL-E: OpenAI's image generation model
3. Set dimensions: Choose from 512×512 up to 1280×1280
4. (Optional) Set a seed value for reproducible results
5. Select the number of images to generate:
   - Generate a single image (default)
   - Generate 2 images in a row
   - Generate 4 images in a grid layout

When generating multiple images, the system will:
- Use the same prompt for all images
- Increment the seed value for each image (for variety)
- Display all images in a responsive grid layout
- Show the seed value for each generated image
- Process images sequentially with a delay to avoid rate limiting
- Automatically retry if rate limits are encountered

> **Note about rate limits**: The Zero2Launch API may have rate limits that restrict how quickly you can make multiple requests. The application handles this by spacing out requests and implementing automatic retries with increasing delays when needed.

## Customizing the System Prompt

You can customize the system prompt that guides the Text AI's behavior:

1. Toggle the "Customize system prompt" switch
2. Edit the prompt in the text area that appears
3. Your next message will use the custom system prompt

## Technical Details

- Frontend: HTML, CSS, JavaScript with jQuery
- Backend: Node.js with Express
- Key technologies:
  - Axios for server-side HTTP requests
  - CORS middleware for cross-origin resource handling
  - Bootstrap 5 for responsive styling
  - Font Awesome for icons
  - Blob and audio/image handling for binary data

## API Key Security

The API key is stored securely on the server side in the proxy implementation, providing better security than embedding it in client-side code.

For even better security in production:
1. Use environment variables to store the API key
2. Implement user authentication before allowing API access
3. Set up rate limiting to prevent abuse

## Troubleshooting

### CORS Errors
If you see CORS errors when making direct API calls, use the proxy server method instead of direct browser calls.

### API Key Issues
If you get authentication errors, verify your API key is correct in the `server.js` file.

### Audio or Image Not Loading
If media doesn't load, check that:
1. Your browser supports the required media formats
2. You're running with the server (not in demo mode)
3. The API response is returning valid binary data

## License

MIT License - Feel free to modify and use as needed. 