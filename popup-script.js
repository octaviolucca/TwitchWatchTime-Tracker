// Formats the time in seconds into a string representation (HH:mm:ss or HH:mm) currently only using HH:mm:ss
function formatTime(timeInSeconds, showSeconds = true) {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = timeInSeconds % 60;
  return showSeconds
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// Calculates the total time spent on Twitch channels
// based on the given timeKeyPrefix (today, week, month, or all-time)
function getTotalTime(timeKeyPrefix, channelTimeArray) {
  return channelTimeArray.reduce((total, channel) => {
    return total + (channel[timeKeyPrefix] || 0);
  }, 0);
}

// DOM elements and event listeners for the popup UI
const mainPage = document.getElementById("mainPage");
const optionsPage = document.getElementById("optionsPage");
document.getElementById("downloadData").addEventListener("click", downloadData);
document.getElementById("deleteData").addEventListener("click", deleteData);
document.getElementById("importData").addEventListener("change", importData);

document.getElementById("optionsButton").addEventListener("click", () => {
  mainPage.classList.remove("active");
  optionsPage.classList.add("active");
});

document.getElementById("backToMain").addEventListener("click", () => {
  optionsPage.classList.remove("active");
  mainPage.classList.add("active");
});


const muteCheckbox = document.querySelector('#muteTracking');

muteCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ trackMutedStreams: muteCheckbox.checked });
});

chrome.storage.local.get('trackMutedStreams', (data) => {
  if (data.hasOwnProperty('trackMutedStreams')) {
    muteCheckbox.checked = data.trackMutedStreams;
  } else {
    // Set a default value if trackMutedStreams is not yet stored
    muteCheckbox.checked = false;
    chrome.storage.local.set({ trackMutedStreams: false });
  }
});


// Imports data from a file and updates the browser's local storage
function importData(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        chrome.storage.local.set(data, function() {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
          } else {
            alert("Data imported successfully.");
            location.reload(); // Reload the popup to update the displayed data
          }
        });
      } catch (error) {
        alert("Error parsing the imported data. Please ensure the file is valid.");
      }
    };
    reader.readAsText(file);
  }
}

// Downloads the data stored in the browser's local storage as a JSON file
function downloadData() {
  chrome.storage.local.get(null, function (items) {
    // Convert object to a string.
    var result = JSON.stringify(items);

    // Custom function to convert a Unicode string to base64
    function b64EncodeUnicode(str) {
      return btoa(
        encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function toSolidBytes(match, p1) {
          return String.fromCharCode("0x" + p1);
        })
      );
    }
    // Save as file
    var url = "data:application/json;base64," + b64EncodeUnicode(result);
    chrome.downloads.download({
      url: url,
      filename: "twitchWatchTime_data.json",
    });
  });
}


// Deletes all data stored in the browser's local storage
function deleteData() {
  if (confirm("Are you sure you want to delete all data?")) {
    chrome.storage.local.clear(function() {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
      } else {
        alert("All data has been deleted.");
        location.reload(); // Reload the popup to update the displayed data
      }
    });
  }
}

// Updates the display of the popup with the channel and total watch time data
function updateDisplay() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, { type: "getChannelInfo" }, (response) => {
      const currentChannel = response ? response.channelName : null;

      chrome.storage.local.get(null, (data) => {
        const channelTimes = document.getElementById("channelTimes");
        channelTimes.innerHTML = '';

        const channelTimeArray = Object.keys(data)
          .filter((key) => key.startsWith('channel_') && !key.startsWith('day_') && !key.startsWith('week_') && !key.startsWith('month_'))
          .map((key) => {
            const channelName = key.slice(8);
            const todayKey = `day_${channelName}_${new Date().setHours(0, 0, 0, 0)}`;
            const weekKey = `week_${channelName}_${new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).setHours(0, 0, 0, 0)}`;
            const monthKey = `month_${channelName}_${new Date(new Date().setDate(1)).setHours(0, 0, 0, 0)}`;

            return {
              channelName,
              time: data[key],
              today: data[todayKey] || 0,
              week: data[weekKey] || 0,
              month: data[monthKey] || 0
            };
          })
          .sort((a, b) => b.time - a.time);

        channelTimeArray.forEach(({ channelName, time, today, week, month }) => {
          const timeElement = document.createElement("div");
          timeElement.className = "channelTime";
          if (channelName === currentChannel) {
            timeElement.classList.add("currentChannel");
          }
          timeElement.innerHTML = `
          <span class="channelName">${channelName}:</span>
          <span>${formatTime(today)}</span>
          <span>${formatTime(week)}</span>
          <span>${formatTime(month)}</span>
          <span>${formatTime(time)}</span>
        `;
          channelTimes.appendChild(timeElement);
        });

  
  const totalTimes = document.getElementById("totalTimes");
  const totalTimeToday = getTotalTime("today", channelTimeArray);
  const totalTimeWeek = getTotalTime("week", channelTimeArray);
  const totalTimeMonth = getTotalTime("month", channelTimeArray);
  const totalTimeAllTime = getTotalTime("time", channelTimeArray);
  totalTimes.innerHTML = `
  <div class="channelTime totalTimeContainer">
    <span class="channelName">Total:</span>
    <span>${formatTime(totalTimeToday)}</span>
    <span>${formatTime(totalTimeWeek)}</span>
    <span>${formatTime(totalTimeMonth)}</span>
    <span>${formatTime(totalTimeAllTime)}</span>
  </div>
  `;
      });
    });
  });
}



// Set up the initial display and a recurring interval for updating the display
document.addEventListener("DOMContentLoaded", () => {
  updateDisplay();
  setInterval(updateDisplay, 1000);
});
