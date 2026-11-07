import React, { useEffect, useRef } from 'react';

interface ProceduralCanvasProps {
  theme: 'trending' | 'nature' | 'urban' | 'music' | 'cute' | 'creative';
  isPlaying: boolean;
}

export const ProceduralCanvas: React.FC<ProceduralCanvasProps> = ({ theme, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    // Resize handler
    const updateSize = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || 360;
      canvas.height = canvas.parentElement?.clientHeight || 640;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Particle storage for themes
    const stars: { x: number; y: number; z: number; size: number }[] = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 1200,
        z: Math.random() * 800 + 10,
        size: Math.random() * 2 + 1,
      });
    }

    const render = () => {
      if (!ctx || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;

      if (isPlaying) {
        t += 0.02;
      }

      ctx.clearRect(0, 0, w, h);

      if (theme === 'trending' || theme === 'creative') {
        // Futuristic fluid aurora gradient
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#0f0c29');
        grad.addColorStop(0.5, '#302b63');
        grad.addColorStop(1, '#24243e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Flowing sine ribbon waves
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          const waveHue = (t * 20 + j * 45) % 360;
          ctx.strokeStyle = `hsla(${waveHue}, 85%, 65%, 0.35)`;
          ctx.lineWidth = 14 + j * 6;
          for (let x = 0; x <= w; x += 15) {
            const y = h * 0.45 + Math.sin(x * 0.012 + t * 1.5 + j) * 80 + Math.cos(x * 0.006 + t) * 40;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (theme === 'urban') {
        // Cyberpunk synthwave perspective grid
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#09090e');
        bgGrad.addColorStop(0.65, '#1e0826');
        bgGrad.addColorStop(1, '#ff007f');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Neon sun
        const sunY = h * 0.5;
        const sunGrad = ctx.createRadialGradient(w / 2, sunY, 10, w / 2, sunY, 90);
        sunGrad.addColorStop(0, '#ffed4a');
        sunGrad.addColorStop(0.6, '#ff0844');
        sunGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(w / 2, sunY, 90, 0, Math.PI * 2);
        ctx.fill();

        // Perspective grid lines
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1.5;
        const horizon = h * 0.62;
        for (let x = -w; x <= w * 2; x += 50) {
          ctx.beginPath();
          ctx.moveTo(w / 2, horizon);
          ctx.lineTo(x * 2 - w / 2, h);
          ctx.stroke();
        }

        const gridSpeed = (t * 40) % 30;
        for (let y = horizon; y < h; y += 18) {
          const dy = y + gridSpeed;
          if (dy < h) {
            ctx.beginPath();
            ctx.moveTo(0, dy);
            ctx.lineTo(w, dy);
            ctx.stroke();
          }
        }
      } else if (theme === 'nature') {
        // Deep emerald canopy and glowing floating orbs
        const natGrad = ctx.createLinearGradient(0, 0, 0, h);
        natGrad.addColorStop(0, '#021B1A');
        natGrad.addColorStop(0.7, '#073B3A');
        natGrad.addColorStop(1, '#0B6E4F');
        ctx.fillStyle = natGrad;
        ctx.fillRect(0, 0, w, h);

        // Floating glowing nature spores
        for (let i = 0; i < stars.length; i++) {
          const p = stars[i];
          const px = (p.x + w / 2 + Math.sin(t + i) * 30) % w;
          const py = (p.y + t * 40 + i * 15) % h;
          ctx.fillStyle = `rgba(163, 230, 53, ${0.3 + 0.3 * Math.sin(t * 2 + i)})`;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (theme === 'music') {
        // Audio visualizer tunnel
        ctx.fillStyle = '#05050a';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        for (let r = 20; r < 240; r += 28) {
          const wave = Math.sin(t * 3 + r * 0.05) * 14;
          ctx.strokeStyle = `hsla(${(r * 2 + t * 40) % 360}, 90%, 65%, 0.7)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, r + wave, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // Cute / Cosmic starfield
        ctx.fillStyle = '#080514';
        ctx.fillRect(0, 0, w, h);

        // Warp stars
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          if (isPlaying) {
            s.z -= 4;
            if (s.z <= 0) s.z = 800;
          }
          const k = 200 / s.z;
          const px = s.x * k + w / 2;
          const py = s.y * k + h / 2;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const rad = Math.max(0.8, (1 - s.z / 800) * 3.5);
            ctx.fillStyle = `rgba(236, 72, 153, ${1 - s.z / 800})`;
            ctx.beginPath();
            ctx.arc(px, py, rad, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateSize);
    };
  }, [theme, isPlaying]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />;
};
