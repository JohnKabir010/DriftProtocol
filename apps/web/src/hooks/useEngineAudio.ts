"use client";

import { useCallback, useEffect, useRef } from "react";

interface AudioNodes {
  ctx: AudioContext;
  osc1: OscillatorNode;   // primary sawtooth
  osc2: OscillatorNode;   // detuned square (thickness)
  noiseGain: GainNode;    // tire screech level
  engineGain: GainNode;   // master engine volume
  filter: BiquadFilterNode;
  noiseSource: AudioBufferSourceNode;
  masterGain: GainNode;
}

let sharedNodes: AudioNodes | null = null;

function buildNoise(ctx: AudioContext): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2; // 2-second looping noise
  const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function createAudioNodes(): AudioNodes {
  const ctx = new AudioContext();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.12;
  masterGain.connect(ctx.destination);

  // Engine oscillators
  const engineGain = ctx.createGain();
  engineGain.gain.value = 1;
  engineGain.connect(masterGain);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  filter.Q.value = 1.4;
  filter.connect(engineGain);

  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.value = 60;
  osc1.connect(filter);
  osc1.start();

  const osc2 = ctx.createOscillator();
  osc2.type = "square";
  osc2.frequency.value = 63; // 3Hz detune
  osc2.connect(filter);
  osc2.start();

  // Tire screech (white noise through bandpass)
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  noiseGain.connect(masterGain);

  const screamFilter = ctx.createBiquadFilter();
  screamFilter.type = "bandpass";
  screamFilter.frequency.value = 2400;
  screamFilter.Q.value = 2;
  screamFilter.connect(noiseGain);

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buildNoise(ctx);
  noiseSource.loop = true;
  noiseSource.connect(screamFilter);
  noiseSource.start();

  return { ctx, osc1, osc2, noiseGain, engineGain, filter, noiseSource, masterGain };
}

export function useEngineAudio() {
  const nodesRef = useRef<AudioNodes | null>(null);
  const prevBoostRef = useRef(false);

  // Lazily start AudioContext on first user interaction.
  const ensureNodes = useCallback(() => {
    if (nodesRef.current) return nodesRef.current;
    if (!sharedNodes) sharedNodes = createAudioNodes();
    nodesRef.current = sharedNodes;
    return sharedNodes;
  }, []);

  // Update every frame from the sim.
  const update = useCallback(
    (speedKmh: number, throttle: number, drifting: boolean, boosting: boolean, active: boolean) => {
      const nodes = ensureNodes();
      if (nodes.ctx.state === "suspended") void nodes.ctx.resume();

      const t = nodes.ctx.currentTime;
      const speed = Math.max(0, speedKmh);

      // Engine pitch: 60Hz idle → ~220Hz at 200 km/h
      const freq = 60 + speed * 0.8 + throttle * 40;
      nodes.osc1.frequency.setTargetAtTime(freq, t, 0.05);
      nodes.osc2.frequency.setTargetAtTime(freq * 1.05, t, 0.05);

      // Filter cutoff opens with throttle + speed
      const cutoff = 400 + throttle * 1800 + speed * 6;
      nodes.filter.frequency.setTargetAtTime(cutoff, t, 0.08);

      // Engine volume: quiet at idle, full when accelerating
      const engineVol = active ? 0.6 + throttle * 0.4 : 0;
      nodes.engineGain.gain.setTargetAtTime(engineVol, t, 0.1);

      // Tire screech on drift
      const screeVol = drifting && active ? 0.35 + Math.min(speed / 200, 1) * 0.3 : 0;
      nodes.noiseGain.gain.setTargetAtTime(screeVol, t, 0.05);

      // Nitro boost: short frequency spike
      if (boosting && !prevBoostRef.current) {
        nodes.filter.frequency.setValueAtTime(4000, t);
        nodes.filter.frequency.linearRampToValueAtTime(cutoff, t + 0.35);
      }
      prevBoostRef.current = boosting;
    },
    [ensureNodes],
  );

  // Mute on unmount.
  useEffect(() => {
    return () => {
      if (nodesRef.current) {
        nodesRef.current.masterGain.gain.setTargetAtTime(0, nodesRef.current.ctx.currentTime, 0.1);
      }
    };
  }, []);

  return { update };
}
