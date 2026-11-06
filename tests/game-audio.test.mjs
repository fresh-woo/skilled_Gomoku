import assert from 'node:assert/strict'
import test from 'node:test'

test('first skill waits for gesture resume; mute and delayed resume never replay stale sound', async (t) => {
  const original = globalThis.AudioContext
  let instance
  const starts = []
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} })
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), start() { starts.push(this) }, stop() {} })
  globalThis.AudioContext = class {
    state = 'suspended'
    currentTime = 0
    sampleRate = 48000
    destination = node()
    constructor() { instance = this }
    createGain = node
    createOscillator = node
    createBufferSource = node
    createBuffer = (_channels, length) => ({ getChannelData: () => new Float32Array(length) })
    resume() { return new Promise((resolve) => { this.finishResume = () => { this.state = 'running'; resolve() } }) }
  }
  t.after(() => { if (original) globalThis.AudioContext = original; else delete globalThis.AudioContext })
  const audio = await import('../src/features/game-sound/audio.ts')
  await audio.playGameSounds(['skill'])
  assert.equal(instance, undefined, 'network events cannot create/unlock audio')
  audio.unlockGameSound()
  const first = audio.playGameSounds(['skill'])
  assert.equal(starts.length, 0)
  instance.finishResume()
  await first
  assert.ok(starts.length > 0, 'the first accepted skill survives in-flight resume')
  let count = starts.length
  instance.state = 'suspended'
  await audio.playGameSounds(['skill'])
  assert.equal(starts.length, count, 'suspended audio without a gesture is not queued')
  audio.unlockGameSound()
  const muted = audio.playGameSounds(['skill'])
  audio.setSoundEnabled(false)
  audio.setSoundEnabled(true)
  instance.finishResume()
  await muted
  assert.equal(starts.length, count, 'mute invalidates pending playback even after unmuting')
  instance.state = 'suspended'
  audio.unlockGameSound()
  const stale = audio.playGameSounds(['skill'])
  await new Promise((resolve) => setTimeout(resolve, 280))
  instance.finishResume()
  await stale
  assert.equal(starts.length, count, 'old resume events cannot play late')
  await audio.playGameSounds(['skill'])
  assert.ok(starts.length > count, 'new skills still play after recovery')
  count = starts.length
  await audio.playGameSounds(['turn-end'])
  assert.equal(starts.length, count, 'old servers cannot play removed turn-end cues')
})
