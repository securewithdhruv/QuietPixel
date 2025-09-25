import React, { useState, useRef } from 'react';
import Background from './Background';
import './App.css';

function App() {
  const [mode, setMode] = useState('encode');
  const [image, setImage] = useState(null);
  const [message, setMessage] = useState('');
  const [outputImage, setOutputImage] = useState(null);
  const [decodedMessage, setDecodedMessage] = useState('');
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_IMAGE_DIMENSION = 4096; // Max width/height in pixels
  const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/bmp', 'image/gif'];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setStatus('Error: No file selected.');
      return;
    }
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      setStatus('Error: Unsupported file format. Use PNG, JPEG, SVG, WebP, BMP, or GIF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus('Error: Image file size exceeds 10MB limit.');
      return;
    }
    if (file.type === 'image/jpeg' || file.type === 'image/gif') {
      setStatus('Warning: PNG is recommended for best results due to lossless compression.');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width > MAX_IMAGE_DIMENSION || img.height > MAX_IMAGE_DIMENSION) {
          setStatus(`Error: Image dimensions exceed ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}.`);
          return;
        }
        setImage({ src: e.target.result, file, width: img.width, height: img.height, type: file.type });
        setStatus('');
      };
      img.onerror = () => setStatus('Error: Failed to load image. It may be corrupted or invalid.');
      img.src = e.target.result;
    };
    reader.onerror = () => setStatus('Error: Failed to read image file.');
    reader.readAsDataURL(file);
  };

  const getMaxMessageLength = () => {
    if (!image) return 0;
    const pixelCount = image.width * image.height;
    return Math.floor((pixelCount * 3) / 8) - 2; // 3 bits per pixel, minus 2 bytes for delimiter
  };

  const rasterizeSVG = async (svgDataUrl, width, height) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas API not supported.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to rasterize SVG.'));
      img.src = svgDataUrl;
    });
  };

  const encodeImage = async () => {
    if (isProcessing) return;
    if (!image) {
      setStatus('Error: Please upload an image.');
      return;
    }
    if (!message) {
      setStatus('Error: Please enter a message.');
      return;
    }
    const maxLength = getMaxMessageLength();
    if (message.length > maxLength) {
      setStatus(`Error: Message is too long (max ${maxLength} characters).`);
      return;
    }

    setIsProcessing(true);
    setStatus('Encoding...');

    try {
      let imageSrc = image.src;
      if (image.type === 'image/svg+xml') {
        imageSrc = await rasterizeSVG(image.src, image.width, image.height);
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas API not supported in this browser.');
      }

      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to process image.'));
      });

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert message to binary with delimiter (UTF-8 support)
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);
      let binaryMessage = '';
      for (const byte of messageBytes) {
        binaryMessage += byte.toString(2).padStart(8, '0');
      }
      binaryMessage += '1111111111111110';

      let dataIndex = 0;
      for (let i = 0; i < data.length && dataIndex < binaryMessage.length; i += 4) {
        for (let j = 0; j < 3 && dataIndex < binaryMessage.length; j++) {
          data[i + j] = (data[i + j] & ~1) | parseInt(binaryMessage[dataIndex]);
          dataIndex++;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const outputUrl = canvas.toDataURL('image/png');
      setOutputImage(outputUrl);
      setStatus('Message encoded successfully! Download the image below.');
    } catch (error) {
      setStatus(`Error: Encoding failed - ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const decodeImage = async () => {
    if (isProcessing) return;
    if (!image) {
      setStatus('Error: Please upload an image.');
      return;
    }

    setIsProcessing(true);
    setStatus('Decoding...');

    try {
      let imageSrc = image.src;
      if (image.type === 'image/svg+xml') {
        imageSrc = await rasterizeSVG(image.src, image.width, image.height);
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas API not supported in this browser.');
      }

      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to process image.'));
      });

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let binaryMessage = '';
      for (let i = 0; i < data.length; i += 4) {
        for (let j = 0; j < 3; j++) {
          binaryMessage += (data[i + j] & 1).toString();
        }
      }

      const endMarker = '1111111111111110';
      const endIndex = binaryMessage.indexOf(endMarker);
      if (endIndex === -1) {
        setStatus('Error: No valid hidden message found.');
        setDecodedMessage('');
        setIsProcessing(false);
        return;
      }

      const messageBytes = [];
      for (let i = 0; i < endIndex; i += 8) {
        const byte = binaryMessage.slice(i, i + 8);
        messageBytes.push(parseInt(byte, 2));
      }
      const decoder = new TextDecoder('utf-8');
      const message = decoder.decode(new Uint8Array(messageBytes));
      setDecodedMessage(message);
      setStatus('Message decoded successfully!');
    } catch (error) {
      setStatus(`Error: Decoding failed - ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    if (isProcessing) return;
    setImage(null);
    setMessage('');
    setOutputImage(null);
    setDecodedMessage('');
    setStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <Background />
      <h1 className="text-4xl md:text-6xl font-bold neon-text glitch mb-4">QuietPixel</h1>
      <p className="text-lg text-cyan-300 mb-8 neon-text">Hide. Protect. Reveal.</p>
      <div className="w-full max-w-lg bg-gray-900 bg-opacity-80 p-6 rounded-lg neon-border relative z-10">
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
            <div className="animate-spin h-8 w-8 border-4 border-t-transparent border-cyan-400 rounded-full"></div>
          </div>
        )}
        <div className="flex justify-center mb-4">
          <button
            className={`px-4 py-2 mr-2 rounded ${mode === 'encode' ? 'bg-pink-600' : 'bg-gray-700'} hover:bg-pink-500 text-white neon-text ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !isProcessing && setMode('encode')}
            disabled={isProcessing}
          >
            Encode
          </button>
          <button
            className={`px-4 py-2 rounded ${mode === 'decode' ? 'bg-cyan-600' : 'bg-gray-700'} hover:bg-cyan-500 text-white neon-text ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !isProcessing && setMode('decode')}
            disabled={isProcessing}
          >
            Decode
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-cyan-300 mb-2">Upload Image (PNG, JPEG, SVG, WebP, BMP, GIF):</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/bmp,image/gif"
            ref={fileInputRef}
            className="w-full text-white bg-gray-800 p-2 rounded neon-border"
            onChange={handleImageUpload}
            disabled={isProcessing}
          />
        </div>
        {mode === 'encode' && (
          <div className="mb-4">
            <label className="block text-pink-300 mb-2">
              Secret Message (Max {getMaxMessageLength()} characters):
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-gray-800 text-white p-2 rounded neon-border"
              rows="4"
              placeholder="Enter your secret message..."
              disabled={isProcessing}
            />
          </div>
        )}
        <div className="flex justify-between mb-4">
          <button
            onClick={mode === 'encode' ? encodeImage : decodeImage}
            className={`px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded neon-text ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isProcessing}
          >
            {mode === 'encode' ? 'Encode Message' : 'Decode Message'}
          </button>
          <button
            onClick={reset}
            className={`px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded neon-text ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isProcessing}
          >
            Reset
          </button>
        </div>
        {status && (
          <p className={`text-center ${status.includes('Error') ? 'text-red-400' : status.includes('Warning') ? 'text-yellow-400' : 'text-green-400'} neon-text`}>
            {status}
          </p>
        )}
        {outputImage && mode === 'encode' && (
          <div className="mt-4">
            <p className="text-cyan-300 mb-2">Encoded Image (PNG):</p>
            <img src={outputImage} alt="Encoded" className="w-full rounded neon-border" />
            <a
              href={outputImage}
              download="encoded_image.png"
              className="block mt-2 text-center px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded neon-text"
            >
              Download Encoded Image
            </a>
          </div>
        )}
        {decodedMessage && mode === 'decode' && (
          <div className="mt-4">
            <p className="text-pink-300 mb-2">Decoded Message:</p>
            <p className="bg-gray-800 p-4 rounded neon-border text-white">{decodedMessage}</p>
          </div>
        )}
      </div>
      <p className="mt-8 text-gray-400 text-sm z-10">
        QuietPixel: A cyberpunk steganography tool by Dhruvesh Tripathi
      </p>
    </div>
  );
}

export default App;