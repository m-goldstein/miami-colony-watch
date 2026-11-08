import { parseSerialLine, SerialLineDecoder } from './serial-protocol.js';

export class SerialConnection {
  constructor({ serial = globalThis.navigator?.serial, onFrame = () => {}, onState = () => {}, onError = () => {} } = {}) {
    Object.assign(this, { serial, onFrame, onState, onError });
    this.state = 'disconnected'; this.port = null; this.reader = null; this.writer = null;
    this.writeQueue = Promise.resolve(); this.readTask = null; this.closing = null; this.intervalMs = 1000; this.opened = false;
  }
  setState(state, message) { this.state = state; this.onState({ state, message }); }
  async connect(intervalMs = 1000) {
    if (!this.serial) throw new Error('This browser does not expose Web Serial. Use a supported desktop browser on localhost or HTTPS.');
    if (this.state !== 'disconnected') throw new Error('A serial connection is already open or changing');
    this.intervalMs = intervalMs;
    this.setState('choosing', 'Choose the Arduino USB port in the browser prompt.');
    try {
      // This is called directly from the Connect click to preserve user activation.
      this.port = await this.serial.requestPort();
      this.setState('opening', 'Opening USB at 115200 baud. The board may restart.');
      await this.port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', bufferSize: 4096 });
      this.opened = true;
      if (!this.port.readable || !this.port.writable) throw new Error('The selected port has no readable/writable streams');
      this.writer = this.port.writable.getWriter();
      this.reader = this.port.readable.getReader();
      this.onDisconnect = event => { if (event.target === this.port || event.port === this.port) void this.disconnect('USB device disconnected.'); };
      this.serial.addEventListener('disconnect', this.onDisconnect);
      this.setState('connected', 'USB open. Waiting for the Arduino to finish starting.');
      const port = this.port;
      this.readTask = this.readLoop();
      this.readTask.then(reason => { if (this.port === port && !this.closing) void this.disconnect(reason); });
      // An Uno often resets on open. Its boot event configures the stream; this
      // fallback also handles boards opened after their startup message passed.
      this.startupTimer = setTimeout(() => { void this.configure().catch(error => this.onError(error)); }, 2000);
      return true;
    } catch (error) {
      await this.disconnect(error.name === 'NotFoundError' ? 'No port selected.' : 'Could not open USB. Close Serial Monitor and the Node gateway, then retry.');
      if (error.name === 'NotFoundError') return false;
      throw error;
    }
  }
  async readLoop() {
    const reader = this.reader;
    const lines = new SerialLineDecoder(line => {
      try {
        const frame = parseSerialLine(line);
        this.onFrame(frame, line);
        if (frame.type === 'event' && frame.data.event === 'boot') {
          clearTimeout(this.startupTimer);
          void this.configure().catch(error => this.onError(error));
        }
      } catch (error) { this.onError(error, 'frame'); }
    }, error => this.onError(error, 'frame'));
    try {
      while (this.state === 'connected') {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) lines.push(value);
      }
      return 'Serial stream closed.';
    } catch (error) {
      if (!this.closing) this.onError(new Error(`USB read stopped: ${error.message}`));
      return 'USB stream lost. Reconnect the Arduino to continue.';
    } finally {
      reader.releaseLock();
      if (this.reader === reader) this.reader = null;
    }
  }
  send(command) {
    if (this.state !== 'connected' || !this.writer) return Promise.reject(new Error('Connect the Arduino first'));
    if (!/^(HELLO|SAMPLE|A|B|STREAM (?:[0-9]{3,5}))$/.test(command)) return Promise.reject(new Error('Unsupported serial command'));
    const writer = this.writer;
    const write = this.writeQueue.catch(() => {}).then(() => writer.write(new TextEncoder().encode(command + '\n')));
    this.writeQueue = write;
    return write;
  }
  async configure() {
    if (this.state !== 'connected') return;
    await this.send('HELLO'); await this.send(`STREAM ${this.intervalMs}`); await this.send('SAMPLE');
  }
  async setIntervalMs(value) {
    if (!Number.isInteger(value) || value < 250 || value > 60000) throw new Error('Choose a stream interval between 250 and 60000ms');
    await this.send(`STREAM ${value}`); this.intervalMs = value;
  }
  disconnect(message = 'Disconnected. The board keeps sensing locally.') {
    if (this.closing) return this.closing;
    clearTimeout(this.startupTimer);
    if (this.onDisconnect) this.serial?.removeEventListener('disconnect', this.onDisconnect);
    if (!this.port) { this.setState('disconnected', message); return Promise.resolve(); }
    const port = this.port;
    this.setState('closing', 'Closing USB…');
    this.closing = (async () => {
      // Establish the closing promise before cleanup can complete synchronously.
      await Promise.resolve();
      try {
        if (this.reader) await this.reader.cancel().catch(() => {});
        if (this.readTask) await this.readTask;
        if (this.writer) {
          await this.writer.abort().catch(() => {});
          await this.writeQueue.catch(() => {});
          this.writer.releaseLock(); this.writer = null;
        }
        if (this.opened) await port.close();
      } catch (error) { this.onError(new Error(`USB close: ${error.message}`)); }
      finally {
        this.port = null; this.reader = null; this.readTask = null; this.writeQueue = Promise.resolve(); this.closing = null; this.opened = false;
        this.setState('disconnected', message);
      }
    })();
    return this.closing;
  }
}
