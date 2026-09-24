import React, { useEffect, useRef } from "react";
import { SpeechService } from "../services/speechService";

interface Props {
  isActive: boolean;
}

export const AudioVisualizer: React.FC<Props> = ({ isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const barCount = 28;
      const barWidth = width / barCount - 2;

      // Real audio level from microphone
      const realLevel = isActive ? SpeechService.getAudioLevel() : 0;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 4;
        if (isActive) {
          const sinVal = Math.sin(phase + i * 0.45);
          const dynamicBoost = Math.max(0.2, realLevel * 2.5);
          barHeight = Math.max(4, Math.abs(sinVal) * (height - 6) * dynamicBoost);
        }

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isActive) {
          gradient.addColorStop(0, "#38bdf8");
          gradient.addColorStop(1, "#818cf8");
        } else {
          gradient.addColorStop(0, "#334155");
          gradient.addColorStop(1, "#1e293b");
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      phase += 0.08;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive]);

  return (
    <div className="audio-visualizer-container" title={isActive ? "Live Audio Stream Active" : "Audio Inactive"}>
      <canvas ref={canvasRef} width={130} height={28} className="audio-canvas" />
    </div>
  );
};
