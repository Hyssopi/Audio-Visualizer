
// Create the audio context
window.AudioContext = window.AudioContext || window.webkitAudioContext;

/**
 * Setup the audio context, source node, and then play the audio.
 *
 * @param drawWaveformFunction Function reference that draw/update the waveform graph visualization
 * @param drawSpectrumFunction Function reference that draw/update the spectrum graph visualization
 * @param drawSpectrogramFunction Function reference that draw/update the spectrogram graph visualization
 * @param htmlIds HTML canvas IDs
 * @param colorScale Chroma color scale
 * @param mediaUri Audio media URI to play
 * @return Buffer source node
 */
export function playAudio(drawWaveformFunction, drawSpectrumFunction, drawSpectrogramFunction, htmlIds, colorScale, mediaUri)
{
  let audioContext;
  try
  {
    audioContext = new AudioContext();
  }
  catch (exception)
  {
    console.error('No web audio support in this browser.');
  }
  
  let sourceNode = setupAudioNodes(audioContext, drawWaveformFunction, drawSpectrumFunction, drawSpectrogramFunction, htmlIds, colorScale);
  loadSound(audioContext, sourceNode, mediaUri);
  return sourceNode;
}

/**
 * Setup the audio analyser then draw the waveform, spectrum, and spectrogram.
 *
 * @param audioContext Audio context
 * @param drawWaveformFunction Function reference that draw/update the waveform graph visualization
 * @param drawSpectrumFunction Function reference that draw/update the spectrum graph visualization
 * @param drawSpectrogramFunction Function reference that draw/update the spectrogram graph visualization
 * @param htmlIds HTML canvas IDs
 * @param colorScale Chroma color scale
 * @return Buffer source node
 */
function setupAudioNodes(audioContext, drawWaveformFunction, drawSpectrumFunction, drawSpectrogramFunction, htmlIds, colorScale)
{
  // Setup a script node
  let scriptNode = audioContext.createScriptProcessor();
  // Connect to destination
  scriptNode.connect(audioContext.destination);
  
  // Setup an analyzer
  let analyser = audioContext.createAnalyser();
  analyser.smoothingTimeConstant = 0;
  // Higher FFT size means more bins. More bins mean more points to graph.
  // Also means each bin has a smaller range of frequencies so it's kind of like more precise.
  analyser.fftSize = 2048 * 2;
  
  // Create a buffer source node
  let sourceNode = audioContext.createBufferSource();
  sourceNode.connect(analyser);
  analyser.connect(scriptNode);
  
  sourceNode.connect(audioContext.destination);
  
  console.log("Sample rate: " + audioContext.sampleRate + " Hz");
  console.log("FFT size: " + analyser.fftSize);
  // FrequencyBinCount is half of FFT size
  console.log("FrequencyBinCount: " + analyser.frequencyBinCount);
  
  let frequencyPerBin = (audioContext.sampleRate / 2) / analyser.frequencyBinCount;
  console.log("Each frequency bin represents " + frequencyPerBin + " Hz of range");
  console.log("frequencyData[0]" + " is the strength of frequencies from " + (0 * frequencyPerBin) + " Hz to " + ((0 + 1)*frequencyPerBin) + " Hz");
  console.log("frequencyData[1]" + " is the strength of frequencies from " + (1 * frequencyPerBin) + " Hz to " + ((1 + 1)*frequencyPerBin) + " Hz");
  console.log("frequencyData[2]" + " is the strength of frequencies from " + (2 * frequencyPerBin) + " Hz to " + ((2 + 1)*frequencyPerBin) + " Hz");
  console.log("frequencyData[" + (analyser.frequencyBinCount - 1) + "]" + " is the strength of frequencies from " + (analyser.frequencyBinCount - 1) * frequencyPerBin + " Hz to " + (((analyser.frequencyBinCount - 1) + 1) * frequencyPerBin) + " Hz");
  
  // When the script node is called we use information from the analyzer node to draw
  scriptNode.onaudioprocess = function()
  {
    let frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    
    let timeDomainData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(timeDomainData);
    
    if (sourceNode.buffer !== null)
    {
      //console.log(frequencyData);
      //console.log(timeDomainData);
      drawWaveformFunction(timeDomainData, htmlIds.waveformCanvas, colorScale);
      drawSpectrumFunction(frequencyData, htmlIds.spectrumCanvas, colorScale);
      drawSpectrogramFunction(frequencyData, htmlIds.spectrogramCanvas, colorScale);
    }
  }
  
  return sourceNode;
}

/**
 * Load the sound from URI then play it.
 *
 * @param audioContext Audio context
 * @param sourceNode Buffer source node
 * @param uri URI to load the audio from
 */
function loadSound(audioContext, sourceNode, uri)
{
  let request = new XMLHttpRequest();
  request.open('GET', uri, true);
  request.responseType = 'arraybuffer';
  
  // Decode the data when loaded
  request.onload = function()
  {
    // Decode the data
    audioContext.decodeAudioData(request.response, function(buffer)
    {
      // Play sound when audio is decoded
      playSound(sourceNode, buffer, false);
    }, onError);
  }
  request.send();
}

/**
 * Start playing audio.
 *
 * @param sourceNode Buffer source node
 * @param buffer Buffer
 * @param isLoop Whether to loop the audio after it finishes playing
 */
function playSound(sourceNode, buffer, isLoop)
{
  if (sourceNode)
  {
    sourceNode.buffer = buffer;
    sourceNode.start(0);
    sourceNode.loop = isLoop;
    // playbackRates that are not 1.0 are not supported for drawing
    //sourceNode.playbackRate.value = 1.0;
  }
}

/**
 * Stop playing audio.
 *
 * @param sourceNode Buffer source node
 */
export function stopPlayingSound(sourceNode)
{
  if (sourceNode)
  {
    sourceNode.loop = false;
    sourceNode.disconnect();
    sourceNode.stop();
    sourceNode.buffer = null;
  }
}

/**
 * Log error(s).
 *
 * @param exception Exception error
 */
function onError(exception)
{
  console.error(exception);
}
