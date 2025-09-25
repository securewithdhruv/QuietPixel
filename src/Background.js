import React, { useEffect, useRef } from 'react';

const Background = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match window
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Animation setup
    const columns = Math.floor(canvas.width / 20);
    const drops = Array(columns).fill(0);
    const chars = '01';
    const fontSize = 14;

    const draw = () => {
      // Fade background
      ctx.fillStyle = 'rgba(13, 27, 42, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw falling characters
      ctx.font = `${fontSize}px Orbitron, monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        const x = i * 20;
        const y = drops[i] * fontSize;

        // Randomly choose neon color (cyan or pink)
        ctx.fillStyle = Math.random() > 0.5 ? '#00f6ff' : '#ff00ff';
        ctx.fillText(text, x, y);

        // Reset drop when it reaches bottom
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    // Run animation
    const interval = setInterval(draw, 50);

    // Cleanup
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return <canvas ref={canvasRef} className="background-canvas" />;
};

export default Background;