import React, { useEffect, useRef, memo } from "react";

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  audioElement?: HTMLAudioElement | null;
  mediaStream?: MediaStream | null;
  leiaAudioStream?: MediaStream | null;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = memo(
  ({ isActive, isSpeaking, audioElement, mediaStream, leiaAudioStream }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    // User microphone analyser
    const userAnalyserRef = useRef<AnalyserNode | null>(null);
    const userDataArrayRef = useRef<Uint8Array | null>(null);

    // LEIA audio analyser
    const leiaAnalyserRef = useRef<AnalyserNode | null>(null);
    const leiaDataArrayRef = useRef<Uint8Array | null>(null);

    useEffect(() => {
      if (!isActive || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size
      const resizeCanvas = () => {
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      };
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      // Setup audio context
      const audioContext = new AudioContext();

      // Setup user microphone analyser
      if (mediaStream) {
        const userAnalyser = audioContext.createAnalyser();
        userAnalyser.fftSize = 256;
        const userBufferLength = userAnalyser.frequencyBinCount;
        const userDataArray = new Uint8Array(userBufferLength) as Uint8Array;

        userAnalyserRef.current = userAnalyser;
        userDataArrayRef.current = userDataArray;

        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(userAnalyser);
      }

      // Setup LEIA audio analyser - use leiaAudioStream directly
      if (leiaAudioStream) {
        try {
          const leiaAnalyser = audioContext.createAnalyser();
          leiaAnalyser.fftSize = 256;
          const leiaBufferLength = leiaAnalyser.frequencyBinCount;
          const leiaDataArray = new Uint8Array(leiaBufferLength) as Uint8Array;

          leiaAnalyserRef.current = leiaAnalyser;
          leiaDataArrayRef.current = leiaDataArray;

          console.log("LEIA stream tracks:", leiaAudioStream.getTracks());
          const source = audioContext.createMediaStreamSource(leiaAudioStream);
          source.connect(leiaAnalyser);
          console.log("✅ LEIA audio analyser connected successfully");
        } catch (error) {
          console.error("❌ Error setting up LEIA audio analyser:", error);
        }
      }

      // Animation loop
      const draw = () => {
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        // Helper function to draw a wave
        const drawWave = (
          dataArray: Uint8Array | null,
          color: string,
          offset: number = 0,
          alpha: number = 1.0
        ) => {
          if (!dataArray) return;

          const points = 60;
          const stepX = width / (points - 1);

          ctx.beginPath();
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;

          for (let i = 0; i < points; i++) {
            const dataIndex = Math.floor((i / points) * dataArray.length);
            const value = dataArray[dataIndex];
            const amplitude = (value / 255) * (height * 0.3);

            const x = i * stepX;
            const y = height / 2 + (Math.sin(i * 0.3) * amplitude * 0.5) + offset;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              const prevX = (i - 1) * stepX;
              const prevDataIndex = Math.floor(((i - 1) / points) * dataArray.length);
              const prevValue = dataArray[prevDataIndex];
              const prevAmplitude = (prevValue / 255) * (height * 0.3);
              const prevY = height / 2 + (Math.sin((i - 1) * 0.3) * prevAmplitude * 0.5) + offset;

              const cpX = (prevX + x) / 2;
              const cpY = (prevY + y) / 2;
              ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
            }
          }

          ctx.stroke();
          ctx.globalAlpha = 1.0;
        };

        // Clear canvas
        ctx.fillStyle = "#F9FAFB";
        ctx.fillRect(0, 0, width, height);

        const hasUserData = userAnalyserRef.current && userDataArrayRef.current;
        const hasLeiaData = leiaAnalyserRef.current && leiaDataArrayRef.current;

        if (hasUserData || hasLeiaData) {
          // Get fresh data
          if (hasUserData) {
            userAnalyserRef.current!.getByteFrequencyData(userDataArrayRef.current! as Uint8Array<ArrayBuffer>);
          }
          if (hasLeiaData) {
            leiaAnalyserRef.current!.getByteFrequencyData(leiaDataArrayRef.current! as Uint8Array<ArrayBuffer>);

            // Debug: Log LEIA data to see if it's changing
            const sum = Array.from(leiaDataArrayRef.current!).reduce((a, b) => a + b, 0);
            if (sum > 0) {
              console.log("LEIA audio data sum:", sum);
            }
          }

          // Draw user wave (green)
          if (hasUserData) {
            drawWave(userDataArrayRef.current, "#10B981", 0, 0.9);
            drawWave(userDataArrayRef.current, "#10B981", 0, 0.4);
          }

          // Draw LEIA wave (blue) - overlayed
          if (hasLeiaData) {
            drawWave(leiaDataArrayRef.current, "#3B82F6", 0, 0.9);
            drawWave(leiaDataArrayRef.current, "#3B82F6", 0, 0.4);
          }
        } else {
          // Idle animation - smooth sine waves
          const time = Date.now() / 1000;
          const points = 60;
          const stepX = width / (points - 1);

          // First idle wave
          ctx.beginPath();
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = "#D1D5DB";

          for (let i = 0; i < points; i++) {
            const x = i * stepX;
            const y = height / 2 + Math.sin(time * 2 + i * 0.2) * 15;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              const prevX = (i - 1) * stepX;
              const prevY = height / 2 + Math.sin(time * 2 + (i - 1) * 0.2) * 15;

              const cpX = (prevX + x) / 2;
              const cpY = (prevY + y) / 2;
              ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
            }
          }

          ctx.stroke();

          // Second idle wave
          ctx.beginPath();
          ctx.globalAlpha = 0.5;

          for (let i = 0; i < points; i++) {
            const x = i * stepX;
            const y = height / 2 + Math.sin(time * 2.5 + i * 0.25) * 10;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              const prevX = (i - 1) * stepX;
              const prevY = height / 2 + Math.sin(time * 2.5 + (i - 1) * 0.25) * 10;

              const cpX = (prevX + x) / 2;
              const cpY = (prevY + y) / 2;
              ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
            }
          }

          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        animationFrameRef.current = requestAnimationFrame(draw);
      };

      draw();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        window.removeEventListener("resize", resizeCanvas);
        audioContext.close();
      };
    }, [isActive, isSpeaking, audioElement, mediaStream, leiaAudioStream]);

    return (
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
      />
    );
  }
);

AudioVisualizer.displayName = "AudioVisualizer";
