import React from 'react';
import RingBuffer from '../utils/ring-buffer.js';
import SonicCoder from '../utils/sonic-coder.js';

var audioContext = new window.AudioContext || new webkitAudioContext();
/**
 * Extracts meaning from audio streams.
 *
 * (assumes audioContext is an AudioContext global variable.)
 *
 * 1. Listen to the microphone.
 * 2. Do an FFT on the input.
 * 3. Extract frequency peaks in the ultrasonic range.
 * 4. Keep track of frequency peak history in a ring buffer.
 * 5. Call back when a peak comes up often enough.
 */
export default class SonicServer extends React.Component {

  constructor(props) {
    super(props);
    this.peakThreshold = this.props.peakThreshold || -65;
    this.minRunLength = this.props.minRunLength || 2;
    this.coder = this.props.coder || new SonicCoder(this.props);
    // How long (in ms) to wait for the next character.
    this.timeout = this.props.timeout || 300;
    this.debug = !!this.props.debug;

    this.peakHistory = new RingBuffer(16);
    this.peakTimes = new RingBuffer(16);

    this.callbacks = {};

    this.buffer = '';
    this.isRunning = false;
    this.iteration = 0;
    this.state = {
      isRecv: false,
      message: null
    }

    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.on = this.on.bind(this);
    this.setDebug = this.setDebug.bind(this);
    this.fire_ = this.fire_.bind(this);
    this.onStream_ = this.onStream_.bind(this);
    this.onStreamError_ = this.onStreamError_.bind(this);
    this.getPeakFrequency = this.getPeakFrequency.bind(this);
    this.loop = this.loop.bind(this);
    this.indexToFreq = this.indexToFreq.bind(this);
    this.freqToIndex = this.freqToIndex.bind(this);
    this.analysePeaks = this.analysePeaks.bind(this);
    this.getLastRun = this.getLastRun.bind(this);
    this.debugDraw_ - this.debugDraw_.bind(this);
    this.raf_ = this.raf_.bind(this);
    this.restartServerIfSanityCheckFails = this.restartServerIfSanityCheckFails.bind(this);
    this.restart = this.restart.bind(this);
  }



  /**
   * Start processing the audio stream.
   */
  start() {
    // Start listening for microphone. Continue init in onStream.
    var constraints = {
      audio: { optional: [{ echoCancellation: false }] }
    };
    navigator.webkitGetUserMedia(constraints,
        this.onStream_.bind(this), this.onStreamError_.bind(this));
  }

  /**
   * Stop processing the audio stream.
   */
  stop() {
    this.isRunning = false;
    this.track.stop();
  }

  on(event, callback) {
    if (event == 'message') {
      this.callbacks.message = callback;
    }
    if (event == 'character') {
      this.callbacks.character = callback;
    }
  }

  setDebug(value) {
    this.debug = value;

    var canvas = document.querySelector('canvas');
    if (canvas) {
      // Remove it.
      canvas.parentElement.removeChild(canvas);
    }
  }

  fire_(callback, arg) {
    if (typeof(callback) === 'function') {
      callback(arg);
    }
  }

  onStream_(stream) {
    // Store MediaStreamTrack for stopping later. MediaStream.stop() is deprecated
    // See https://developers.google.com/web/updates/2015/07/mediastream-deprecations?hl=en
    this.track = stream.getTracks()[0];

    // Setup audio graph.
    var input = audioContext.createMediaStreamSource(stream);
    var analyser = audioContext.createAnalyser();
    input.connect(analyser);
    // Create the frequency array.
    this.freqs = new Float32Array(analyser.frequencyBinCount);
    // Save the analyser for later.
    this.analyser = analyser;
    this.isRunning = true;
    // Do an FFT and check for inaudible peaks.
    this.raf_(this.loop.bind(this));
  }

  onStreamError_(e) {
    console.error('Audio input error:', e);
  }

  /**
   * Given an FFT frequency analysis, return the peak frequency in a frequency
   * range.
   */
  getPeakFrequency() {
    // Find where to start.
    var start = this.freqToIndex(this.coder.freqMin);
    // TODO: use first derivative to find the peaks, and then find the largest peak.
    // Just do a max over the set.
    var max = -Infinity;
    var index = -1;
    for (var i = start; i < this.freqs.length; i++) {
      if (this.freqs[i] > max) {
        max = this.freqs[i];
        index = i;
      }
    }
    // Only care about sufficiently tall peaks.
    if (max > this.peakThreshold) {
      return this.indexToFreq(index);
    }
    return null;
  }

  loop() {
    this.analyser.getFloatFrequencyData(this.freqs);
    // Sanity check the peaks every 5 seconds.
    if ((this.iteration + 1) % (60 * 5) == 0) {
      this.restartServerIfSanityCheckFails();
    }
    // Calculate peaks, and add them to history.
    var freq = this.getPeakFrequency();
    if (freq) {
      var char = this.coder.freqToChar(freq);
      // DEBUG ONLY: Output the transcribed char.
      if (this.debug) {
        console.log('Transcribed char: ' + char);
      }
      this.peakHistory.add(char);
      this.peakTimes.add(new Date());
    } else {
      // If no character was detected, see if we've timed out.
      var lastPeakTime = this.peakTimes.last();
      if (lastPeakTime && new Date() - lastPeakTime > this.timeout) {
        // Last detection was over 300ms ago.
        this.setState({isRecv:false});
        if (this.debug) {
          console.log('Token', this.buffer, 'timed out');
        }
        this.peakTimes.clear();
      }
    }
    // Analyse the peak history.
    this.analysePeaks();
    // DEBUG ONLY: Draw the frequency response graph.
    if (this.debug) {
      this.debugDraw_();
    }
    if (this.isRunning) {
      this.raf_(this.loop.bind(this));
    }
    this.iteration += 1;
  }

  indexToFreq(index) {
    var nyquist = audioContext.sampleRate/2;
    return nyquist/this.freqs.length * index;
  }

  freqToIndex(frequency) {
    var nyquist = audioContext.sampleRate/2;
    return Math.round(frequency/nyquist * this.freqs.length);
  }

  /**
   * Analyses the peak history to find true peaks (repeated over several frames).
   */
  analysePeaks() {
    // Look for runs of repeated characters.
    var char = this.getLastRun();
    if (!char) {
      return;
    }
    if (!this.state.isRecv) {
      // If idle, look for start character to go into recv mode.
      if (char == this.coder.startChar) {
        this.buffer = '';
        this.setState({isRecv:true});
      }
    } else if (this.state.isRecv) {
      // If receiving, look for character changes.
      if (char != this.lastChar &&
          char != this.coder.startChar && char != this.coder.endChar) {
        this.buffer += char;
        this.lastChar = char;
        this.fire_(this.callbacks.character, char);
      }
      // Also look for the end character to go into idle mode.
      if (char == this.coder.endChar) {
        this.setState({isRecv:false});
        this.fire_(this.callbacks.message, this.buffer);
        this.buffer = '';
      }
    }
  }

  getLastRun () {
    var lastChar = this.peakHistory.last();
    var runLength = 0;
    // Look at the peakHistory array for patterns like ajdlfhlkjxxxxxx$.
    for (var i = this.peakHistory.length() - 2; i >= 0; i--) {
      var char = this.peakHistory.get(i);
      if (char == lastChar) {
        runLength += 1;
      } else {
        break;
      }
    }
    if (runLength > this.minRunLength) {
      // Remove it from the buffer.
      this.peakHistory.remove(i + 1, runLength + 1);
      return lastChar;
    }
    return null;
  }

  /**
   * DEBUG ONLY.
   */
  debugDraw_() {
    var canvas = document.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      document.body.appendChild(canvas);
    }
    canvas.width = document.body.offsetWidth;
    canvas.height = 480;
    drawContext = canvas.getContext('2d');
    // Plot the frequency data.
    for (var i = 0; i < this.freqs.length; i++) {
      var value = this.freqs[i];
      // Transform this value (in db?) into something that can be plotted.
      var height = value + 400;
      var offset = canvas.height - height - 1;
      var barWidth = canvas.width/this.freqs.length;
      drawContext.fillStyle = 'black';
      drawContext.fillRect(i * barWidth, offset, 1, 1);
    }
  }

  /**
   * A request animation frame shortcut. This one is intended to work even in
   * background pages of an extension.
   */
  raf_(callback) {
    var isCrx = !!(window.chrome && chrome.extension);
    if (isCrx) {
      setTimeout(callback, 1000/60);
    } else {
      requestAnimationFrame(callback);
    }
  }

  restartServerIfSanityCheckFails() {
    // Strange state 1: peaks gradually get quieter and quieter until they
    // stabilize around -800.
    if (this.freqs[0] < -300) {
      console.error('freqs[0] < -300. Restarting.');
      this.restart();
      return;
    }
    // Strange state 2: all of the peaks are -100. Check just the first few.
    var isValid = true;
    for (var i = 0; i < 10; i++) {
      if (this.freqs[i] == -100) {
        isValid = false;
      }
    }
    if (!isValid) {
      console.error('freqs[0:10] == -100. Restarting.');
      this.restart();
    }
  }

  restart() {
    //this.stop();
    //this.start();
    window.location.reload();
  }

  componentDidMount() {
    this.on('message', function(message) {
      console.log(message);
      this.setState({message:message});
    }.bind(this));
    this.start();
  }

  render() {
    return (
        <div>
          <p>Sonic Server Component</p>
          <p>Status: {this.state.isRecv ? "Receiving Message" : "Idle"}</p>
          <p>{this.state.message}</p>
        </div>
      );
  }
}
