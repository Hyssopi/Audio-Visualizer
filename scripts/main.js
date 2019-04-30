
import * as utilities from '../util/utilities.js';
import {playAudio, stopPlayingSound} from './MusicPlayer.js';


// Max value of 8-bit unsigned integer
const MAX_DATA_VALUE = 255;

// Frequency bin count is the length of the data array which is also the width of the chart
// Should be equivalent to analyser.frequencyBinCount
const FREQUENCY_BIN_COUNT = 1024 * 2;

// Colors used for the waveform, spectrum, and spectrogram visualizations
const COLORS = ['blue', 'cyan', 'green', 'yellow', 'red'];

const HTML_IDS =
{
  waveformCanvas: 'waveformCanvasId',
  spectrumCanvas: 'spectrumCanvasId',
  spectrogramCanvas: 'spectrogramCanvasId',
  frequencyLabelCanvas: 'frequencyLabelCanvasId',
  shuffleCheckbox: 'shuffleCheckboxId',
  stopButton: 'stopButtonId',
  nextButton: 'nextButtonId',
  titleSelectMenu: 'titleSelectMenuId',
  currentPlayingTimeText: 'currentPlayingTimeTextId',
  durationPlayingTimeText: 'durationPlayingTimeTextId'
};

// Height is easily modifiable and other parts should work
// Width is not as easily changeable, must somehow modify frequencyBinCount
const WAVEFORM_CANVAS =
{
  width: FREQUENCY_BIN_COUNT + 'px',
  height: '300px',
  style: 'display: block; background-color: black;'
};
const SPECTRUM_CANVAS =
{
  width: FREQUENCY_BIN_COUNT + 'px',
  height: '300px',
  style: 'display: block; background-color: black;'
};
const SPECTROGRAM_CANVAS =
{
  width: FREQUENCY_BIN_COUNT + 'px',
  height: '250px',
  style: 'display: block; background-color: black;'
};
const FREQUENCY_LABEL_CANVAS =
{
  width: FREQUENCY_BIN_COUNT + 'px',
  height: '50px',
  style: 'display: block; background-color: black;'
};

// Index of the current media playing
var playingMediaUriIndex = -1;

// Source node reference of audio context
var sourceNode = null;


const MEDIA_URIS_JSON_PATH = 'config/mediaUris.json';

console.info('Reading: \'' + MEDIA_URIS_JSON_PATH + '\'');
fetch(MEDIA_URIS_JSON_PATH)
  .then(response =>
  {
    if (response.ok)
    {
      return response.json();
    }
    else
    {
      console.error('Configuration was not ok.');
    }
  })
  .then(mediaUris =>
  {
    console.info('Successfully read media URIs:');
    console.log(mediaUris);
    setup(HTML_IDS, WAVEFORM_CANVAS, SPECTRUM_CANVAS, SPECTROGRAM_CANVAS, FREQUENCY_LABEL_CANVAS, COLORS, mediaUris);
  })
  .catch (function(error)
  {
    console.error('Error in fetching: ' + error);
  })


/**
 * Setup the audio visualizer.
 *
 * @param htmlIds HTML canvas IDs
 * @param waveformCanvas Width, height, style information for the waveform canvas
 * @param spectrumCanvas Width, height, style information for the spectrum canvas
 * @param spectrogramCanvas Width, height, style information for the spectrogram canvas
 * @param frequencyLabelCanvas Width, height, style information for the frequency label canvas
 * @param colors Colors used for the waveform, spectrum, and spectrogram visualizations
 * @param mediaUris List of media URIs
 */
function setup(htmlIds, waveformCanvas, spectrumCanvas, spectrogramCanvas, frequencyLabelCanvas, colors, mediaUris)
{
  // Setup canvases
  utilities.setupCanvas(htmlIds.waveformCanvas, waveformCanvas.width, waveformCanvas.height, waveformCanvas.style);
  utilities.setupCanvas(htmlIds.spectrumCanvas, spectrumCanvas.width, spectrumCanvas.height, spectrumCanvas.style);
  utilities.setupCanvas(htmlIds.spectrogramCanvas, spectrogramCanvas.width, spectrogramCanvas.height, spectrogramCanvas.style);
  utilities.setupCanvas(htmlIds.frequencyLabelCanvas, frequencyLabelCanvas.width, frequencyLabelCanvas.height, frequencyLabelCanvas.style);
  
  // Handle when the List / Shuffle checkbox is clicked
  document.getElementById(htmlIds.shuffleCheckbox).onclick = function()
  {
    if (document.getElementById(htmlIds.shuffleCheckbox).innerHTML === 'shuffle')
    {
      document.getElementById(htmlIds.shuffleCheckbox).innerHTML = 'repeat';
    }
    else
    {
      document.getElementById(htmlIds.shuffleCheckbox).innerHTML = 'shuffle';
    }
  };
  
  // Handle when the STOP button is clicked
  document.getElementById(htmlIds.stopButton).onclick = function()
  {
    stopPlayingMediaAudio(htmlIds);
  };
  
  // Handle when the NEXT button is clicked
  document.getElementById(htmlIds.nextButton).onclick = function()
  {
    playNextMediaAudio(htmlIds, colors, mediaUris);
  };
  
  // Setup select menu options with list of audio files
  let titleOptionsHtml = '';
  for (let i = 0; i < mediaUris.length; i++)
  {
    let trimmedFilename = mediaUris[i];
    trimmedFilename = trimmedFilename.substring(0, trimmedFilename.lastIndexOf('.'));
    trimmedFilename = trimmedFilename.substring(trimmedFilename.lastIndexOf('/') + 1, trimmedFilename.length);
    titleOptionsHtml += '<option value="' + mediaUris[i] + '">' + trimmedFilename + '</option>';
  }
  document.getElementById(htmlIds.titleSelectMenu).innerHTML = titleOptionsHtml;
  
  // Handle when the select menu option has changed
  document.getElementById(htmlIds.titleSelectMenu).onchange = function()
  {
    playingMediaUriIndex = document.getElementById(htmlIds.titleSelectMenu).options.selectedIndex;
    let mediaUri = document.getElementById(htmlIds.titleSelectMenu).value;
    playMediaAudio(htmlIds, colors, mediaUri);
  };
  
  // STOP button is disabled on startup
  document.getElementById(htmlIds.stopButton).disabled = true;
  
  // Start timer
  let intervalMilliseconds = 1000;
  setInterval(function()
  {
    if (sourceNode)
    {
      if (sourceNode.buffer)
      {
        document.getElementById(htmlIds.stopButton).disabled = false;
        document.getElementById(htmlIds.nextButton).disabled = false;
        document.getElementById(htmlIds.titleSelectMenu).removeAttribute('disabled');
        
        if (sourceNode.context.currentTime > sourceNode.buffer.duration)
        {
          playNextMediaAudio(htmlIds, colors, mediaUris);
        }
      }
      
      // Update the color for the time
      let timeColor = ['blue', 'red'];
      let timeColorScale = utilities.getColorScale(timeColor, 0, sourceNode.buffer ? Math.floor(sourceNode.buffer.duration) : 0);
      document.getElementById(htmlIds.currentPlayingTimeText).style.color = sourceNode.buffer ? timeColorScale(Math.floor(sourceNode.context.currentTime)).hex() : timeColor[0];
      document.getElementById(htmlIds.durationPlayingTimeText).style.color = timeColor[timeColor.length - 1];
      
      // Update the text for the time
      document.getElementById(htmlIds.currentPlayingTimeText).innerHTML = sourceNode.context.currentTime.toFixed(0).toHHMMSS();
      document.getElementById(htmlIds.durationPlayingTimeText).innerHTML = sourceNode.buffer ? sourceNode.buffer.duration.toFixed(0).toHHMMSS() : '?';
    }
  }, intervalMilliseconds);
}

/**
 * Calculates the next audio media URI to play then plays it.
 *
 * @param htmlIds HTML canvas IDs
 * @param colors Colors used for the waveform, spectrum, and spectrogram visualizations
 * @param mediaUris List of media URIs
 */
function playNextMediaAudio(htmlIds, colors, mediaUris)
{
  if (document.getElementById(htmlIds.shuffleCheckbox).innerHTML === 'shuffle')
  {
    playingMediaUriIndex = utilities.generateRandomInteger(0, mediaUris.length - 1);
  }
  else
  {
    playingMediaUriIndex = (playingMediaUriIndex === mediaUris.length - 1) ? 0 : (playingMediaUriIndex + 1);
  }
  playMediaAudio(htmlIds, colors, mediaUris[playingMediaUriIndex]);
}

/**
 * Plays the specified audio media URI.
 *
 * @param htmlIds HTML canvas IDs
 * @param colors Colors used for the waveform, spectrum, and spectrogram visualizations
 * @param mediaUri Media URI to play
 */
function playMediaAudio(htmlIds, colors, mediaUri)
{
  document.getElementById(htmlIds.stopButton).disabled = true;
  document.getElementById(htmlIds.nextButton).disabled = true;
  document.getElementById(htmlIds.titleSelectMenu).setAttribute('disabled', 'disabled');
  
  if (sourceNode)
  {
    stopPlayingMediaAudio(htmlIds);
  }
  
  // Clear canvases
  utilities.clearCanvas(htmlIds.waveformCanvas, 'black');
  utilities.clearCanvas(htmlIds.spectrumCanvas, 'black');
  utilities.clearCanvas(htmlIds.spectrogramCanvas, 'black');
  utilities.clearCanvas(htmlIds.frequencyLabelCanvas, 'black');
  
  sourceNode = playAudio(drawWaveform, drawSpectrum, drawSpectrogram, htmlIds, utilities.getColorScale(colors, 0, MAX_DATA_VALUE), mediaUri);
  
  let minimumFrequencyRange = 0;
  let maximumFrequencyRange = sourceNode.context.sampleRate / 2;
  drawFrequencyLabels(htmlIds.frequencyLabelCanvas, minimumFrequencyRange, maximumFrequencyRange);
  
  document.getElementById(htmlIds.titleSelectMenu).selectedIndex = playingMediaUriIndex;
}

/**
 * Stops playing the audio media file.
 *
 * @param htmlIds HTML canvas IDs
 */
function stopPlayingMediaAudio(htmlIds)
{
  document.getElementById(htmlIds.stopButton).disabled = true;
  document.getElementById(htmlIds.currentPlayingTimeText).innerHTML = '-';
  document.getElementById(htmlIds.durationPlayingTimeText).innerHTML = '-';
  
  if (sourceNode)
  {
    stopPlayingSound(sourceNode);
    sourceNode = null;
  }
  
  // Clear canvases
  utilities.clearCanvas(htmlIds.waveformCanvas, 'black');
  utilities.clearCanvas(htmlIds.spectrumCanvas, 'black');
  utilities.clearCanvas(htmlIds.spectrogramCanvas, 'black');
  utilities.clearCanvas(htmlIds.frequencyLabelCanvas, 'black');
}

/**
 * Draw/update the waveform graph visualization.
 *
 * @param timeDomainData Time domain data from AnalyserNode at a particular instance
 * @param canvasId HTML canvas ID used to draw on
 * @param colorScale Chroma color scale
 */
function drawWaveform(timeDomainData, canvasId, colorScale)
{
  let canvas = document.getElementById(canvasId);
  if (!canvas)
  {
    console.error('drawWaveform(), canvas is not yet setup');
    return;
  }
  
  let canvasContext = canvas.getContext('2d');
  canvasContext.fillStyle = 'black';
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  
  canvasContext.lineWidth = 2;
  let highestDataValue = Math.max(...timeDomainData);
  canvasContext.strokeStyle = colorScale(highestDataValue).hex();
  
  let sliceWidth = canvas.width * 1.0 / timeDomainData.length;
  
  let x = 0;
  canvasContext.beginPath();
  
  for (let i = 0; i < timeDomainData.length; i++)
  {
    let y = (timeDomainData[i] / (MAX_DATA_VALUE / 2)) * (canvas.height / 2);
    if (i === 0)
    {
      canvasContext.moveTo(x, y);
    }
    else
    {
      canvasContext.lineTo(x, y);
    }
    x += sliceWidth;
  }
  
  canvasContext.lineTo(canvas.width, canvas.height / 2);
  canvasContext.stroke();
}

/**
 * Draw/update the spectrum graph visualization.
 *
 * @param frequencyData Frequency domain data from AnalyserNode at a particular instance
 * @param canvasId HTML canvas ID used to draw on
 * @param colorScale Chroma color scale
 */
function drawSpectrum(frequencyData, canvasId, colorScale)
{
  let canvas = document.getElementById(canvasId);
  if (!canvas)
  {
    console.error('drawSpectrum(), canvas is not yet setup');
    return;
  }
  
  let canvasContext = canvas.getContext('2d');
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let i = 0; i < frequencyData.length; i++)
  {
    let value = frequencyData[i];
    // Coordinate (0,0) starts at top left
    // Draw bar value based on proportion of canvas height and max frequency data value 
    canvasContext.fillStyle = colorScale(value).hex();
    canvasContext.fillRect(i, (canvas.height / MAX_DATA_VALUE) * (MAX_DATA_VALUE - value), 1, canvas.height);
  }
}

/**
 * Draw/update the spectrogram graph visualization.
 *
 * @param frequencyData Frequency domain data from AnalyserNode at a particular instance
 * @param canvasId HTML canvas ID used to draw on
 * @param colorScale Chroma color scale
 */
function drawSpectrogram(frequencyData, canvasId, colorScale)
{
  let canvas = document.getElementById(canvasId);
  if (!canvas)
  {
    console.error('drawSpectrogram(), canvas is not yet setup');
    return;
  }
  
  // Create a temporary canvas we use for copying
  let tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  
  // Copy the current canvas onto the temporary canvas
  let canvasContext = canvas.getContext('2d');
  let tempCanvasContext = tempCanvas.getContext('2d');
  
  tempCanvasContext.drawImage(canvas, 0, 0, canvas.width, canvas.height);
  
  // Iterate over the elements from the frequencyData
  for (let i = 0; i < frequencyData.length; i++)
  {
    // Draw each pixel with the specific color
    let value = frequencyData[i];
    canvasContext.fillStyle = colorScale(value).hex();
    
    // Draw the line at the top side of the canvas
    canvasContext.fillRect(i, 0, 1, 1);
  }
  
  // Set translate on the canvas
  canvasContext.translate(0, 1);
  
  // Draw the copied image
  canvasContext.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  
  // Reset the transformation matrix
  canvasContext.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Draw the frequency labels.
 *
 * @param canvasId HTML canvas ID used to draw on
 * @param minimumFrequency Minimum frequency in hertz
 * @param maximumFrequency Maximum frequency in hertz
 */
function drawFrequencyLabels(canvasId, minimumFrequency, maximumFrequency)
{
  let canvas = document.getElementById(canvasId);
  if (!canvas)
  {
    console.log('drawFrequencyLabels(), canvas is not yet setup');
    return;
  }
  
  let canvasContext = canvas.getContext('2d');
  canvasContext.font = '10px Arial';
  canvasContext.fillStyle = '#FFFFFF';
  
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  
  let yPosition = 0;
  let numberOfLabels = 15;
  let pixelsPerTick = FREQUENCY_BIN_COUNT / numberOfLabels;
  let frequencyPerTick = (maximumFrequency - minimumFrequency) / numberOfLabels;
  let currentTick = 0;
  let yPositionOffset = 15;
  while (currentTick * pixelsPerTick < FREQUENCY_BIN_COUNT)
  {
    // Skip the label if it is near the end
    if (Math.abs(currentTick * pixelsPerTick - FREQUENCY_BIN_COUNT) < (FREQUENCY_BIN_COUNT * 0.02))
    {
      break;
    }
    canvasContext.save();
    if (currentTick === 0)
    {
      canvasContext.textAlign = 'left';
    }
    else
    {
      canvasContext.textAlign = 'center';
    }
    canvasContext.textBaseline = 'top';
    canvasContext.fillText('|', currentTick * pixelsPerTick, yPosition);
    let decimalPrecision = (minimumFrequency + currentTick * frequencyPerTick) > 1e9 ? 1 : 0;
    let formattedHertzString = utilities.formatHertzNumbers(minimumFrequency + currentTick * frequencyPerTick, decimalPrecision);
    canvasContext.fillText(formattedHertzString, currentTick * pixelsPerTick, yPosition + yPositionOffset);
    canvasContext.restore();
    currentTick += 1;
  }
  // Always add the end range frequency label
  currentTick = numberOfLabels;
  canvasContext.save();
  canvasContext.textAlign = 'right';
  canvasContext.textBaseline = 'top';
  canvasContext.fillText('|', currentTick * pixelsPerTick, yPosition);
  let decimalPrecision = (minimumFrequency + currentTick * frequencyPerTick) > 1e9 ? 1 : 0;
  let formattedHertzString = utilities.formatHertzNumbers(minimumFrequency + currentTick * frequencyPerTick, decimalPrecision);
  canvasContext.fillText(formattedHertzString, currentTick * pixelsPerTick, yPosition + yPositionOffset);
  canvasContext.restore();
}
