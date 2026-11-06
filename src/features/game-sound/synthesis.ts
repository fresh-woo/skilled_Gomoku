import type { GameSound } from '../../entities/game/model/soundEvents.ts'

export const GAME_SOUND_GAIN = 0.28

function tone(ctx: BaseAudioContext, output: AudioNode, start: number, length: number, from: number, to: number, volume: number, type: OscillatorType = 'sine', sustain = 0) {
  const oscillator = ctx.createOscillator()
  const envelope = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, start + length)
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.003)
  if (sustain) envelope.gain.setValueAtTime(volume * 0.85, start + sustain)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + length)
  oscillator.connect(envelope)
  envelope.connect(output)
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect() }
  oscillator.start(start)
  oscillator.stop(start + length + 0.01)
}

export function renderGameSound(ctx: BaseAudioContext, output: AudioNode, cue: GameSound, start: number) {
  if (cue === 'skill') {
    // Sustained attack and a brighter harmonic keep this audible next to the stone click.
    tone(ctx, output, start, 0.3, 330, 990, 0.56, 'triangle', 0.09)
    tone(ctx, output, start + 0.035, 0.36, 660, 1320, 0.46, 'sine', 0.1)
    tone(ctx, output, start + 0.12, 0.2, 1320, 1320, 0.28, 'sine', 0.08)
  } else if (cue === 'place') {
    tone(ctx, output, start, 0.075, 880, 210, 0.65)
    tone(ctx, output, start, 0.04, 1800, 720, 0.16, 'triangle')
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.035), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = 0.18
    source.connect(gain)
    gain.connect(output)
    source.onended = () => { source.disconnect(); gain.disconnect() }
    source.start(start)
  }
}
