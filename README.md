# React-Sonic

React components to transmit and receive messages through ultrasonic sound.
> A ReactJs implementation of an awesome library [sonicnet.js] by Boris Smus. Here is the [video] and his [blog post] on ultrasonic networking.

# Run Example
```sh
$ npm install
$ npm start
```

## Components
#### SonicSocket 
Encodes text as audio streams.
1. Receives a string of text.
2. Creates an oscillator.
3. Converts characters into frequencies.
4. Transmits frequencies, waiting in between appropriately.

###### props
- charDuration
- rampDuration

#### SonicServer
Extracts meaning from audio streams
1. Listen to the microphone.
2. Do an FFT on the input.
3. Extract frequency peaks in the ultrasonic range.
4. Keep track of frequency peak history in a ring buffer.
5. Call back when a peak comes up often enough.

###### props
- peakThreshold
- minRunLength
- timeout

[sonicnet.js]: <https://github.com/borismus/sonicnet.js>
[video]: <https://www.youtube.com/watch?v=w6lRq5spQmc>
[blog post]: <http://smus.com/ultrasonic-networking/>