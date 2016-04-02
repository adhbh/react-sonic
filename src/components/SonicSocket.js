import React from 'react';
import SonicCoder from '../utils/sonic-coder.js';

var audioContext = new window.AudioContext || new webkitAudioContext();

/**
 * Encodes text as audio streams.
 *
 * 1. Receives a string of text.
 * 2. Creates an oscillator.
 * 3. Converts characters into frequencies.
 * 4. Transmits frequencies, waiting in between appropriately.
 */
export default class SonicSocket extends React.Component {
  constructor(props) {
    super(props);
    this.coder = this.props.coder || new SonicCoder();
    this.charDuration = this.props.charDuration || 0.2;
    this.coder = this.props.coder || new SonicCoder(this.props);
    this.rampDuration = this.props.rampDuration || 0.001;
    this.state = {
      message: props.message
    }
    this.send = this.send.bind(this);
    this.scheduleToneAt = this.scheduleToneAt.bind(this);
  }

  componentWillRevceiveProps(nextProps) {
    setState({message: nextProps.message});
  }

  send(opt_callback) {
    // Surround the word with start and end characters.
    var input = this.coder.startChar + this.state.message + this.coder.endChar;
    
    // Use WAAPI to schedule the frequencies.
    for (var i = 0; i < input.length; i++) {
      var char = input[i];
      var freq = this.coder.charToFreq(char);
      var time = audioContext.currentTime + this.charDuration * i;
      this.scheduleToneAt(freq, time, this.charDuration);
    }
    // If specified, callback after roughly the amount of time it would have
    // taken to transmit the token.
    if (opt_callback) {
      var totalTime = this.charDuration * input.length;
      setTimeout(function() { opt_callback }, totalTime * 1000);
    }
  }

  scheduleToneAt(freq, startTime, duration) {
    var gainNode = audioContext.createGain();
    // Gain => Merger
    gainNode.gain.value = 0;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(1, startTime + this.rampDuration);
    gainNode.gain.setValueAtTime(1, startTime + duration - this.rampDuration);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    gainNode.connect(audioContext.destination);

    var osc = audioContext.createOscillator();
    osc.frequency.value = freq;
    osc.connect(gainNode);

    osc.start(startTime);
  }

  render() {
    return(
        <div>
          Example Sonic Socket
          <button onClick={this.send}>Send</button>
        </div>
      );  
  }
}
