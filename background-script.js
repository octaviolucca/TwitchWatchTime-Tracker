const MILLISECONDS_IN_DAY = 86400000;
const MILLISECONDS_IN_WEEK = 604800000;
const MILLISECONDS_IN_MONTH = 2592000000;


// Updates the time spent on a channel by incrementing the total time
// value for the given channel and time periods (day, week, month, and all-time)
function updateChannelTime(channelName, timeValue) {
  const todayKey = `day_${channelName}_${new Date().setHours(0, 0, 0, 0)}`;
  const weekKey = `week_${channelName}_${new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).setHours(0, 0, 0, 0)}`;
  const monthKey = `month_${channelName}_${new Date(new Date().setDate(1)).setHours(0, 0, 0, 0)}`;
  const storageKeys = [todayKey, weekKey, monthKey, `channel_${channelName}`];

  chrome.storage.local.get(storageKeys, (data) => {
    const updatedData = storageKeys.reduce((acc, key) => {
      acc[key] = (data[key] || 0) + timeValue;
      return acc;
    }, {});
    chrome.storage.local.set(updatedData);
  });
}

// Cleans up old data stored in the browser's local storage by removing
// outdated records for day and week time periods
function cleanUpOldData() {
  const today = new Date().setHours(0, 0, 0, 0);
  chrome.storage.local.get('lastCleanUp', (data) => {
    if (data.lastCleanUp === undefined || data.lastCleanUp !== today) {
      chrome.storage.local.set({ lastCleanUp: today });

      const lastWeek = today - MILLISECONDS_IN_WEEK;
      const lastMonth = today - MILLISECONDS_IN_MONTH;

      chrome.storage.local.get(null, (data) => {
        Object.keys(data).forEach((key) => {
          if (key.startsWith('day_') || key.startsWith('week_') || key.startsWith('month_')) {
            const timestamp = parseInt(key.split('_')[1], 10);
            if (isNaN(timestamp)) return;

            if ((key.startsWith('day_') && timestamp < lastWeek) ||
                (key.startsWith('week_') && timestamp < lastMonth)) {
              chrome.storage.local.remove(key);
            }
          }
        });
      });
    }
  });
}


// Set up event listeners for the extension's initial installation and
// browser startup to trigger the cleanUpOldData function
chrome.runtime.onInstalled.addListener(cleanUpOldData);
chrome.runtime.onStartup.addListener(cleanUpOldData);

// Initialize intervalID variable
let intervalID;


// Set up a message listener for the contentScriptLoaded event
// This starts an interval for monitoring active Twitch channels
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "contentScriptLoaded") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && /^https:\/\/www\.twitch\.tv\//.test(tab.url)) {
        clearInterval(intervalID);
        intervalID = setInterval(() => {
          chrome.tabs.sendMessage(tab.id, { type: "getChannelInfo" }, (response) => {
            if (chrome.runtime.lastError) {
              clearInterval(intervalID);
            } else if (response.playing && response.muted) {
              updateChannelTime(response.channelName, 1);
            }
          });
        }, 1000);
      }
    });
  }
});

// Handles tab switch or update events by checking if the active tab
// is a Twitch channel and starts a new interval for monitoring the channel
function handleTabSwitch(tabId) {
  clearInterval(intervalID);

  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      return;
    }
    
    if (/^https:\/\/www\.twitch\.tv\//.test(tab.url)) {
      intervalID = setInterval(() => {
        chrome.tabs.sendMessage(tabId, { type: "getChannelInfo" }, (response) => {
          if (chrome.runtime.lastError) {
            clearInterval(intervalID);
          } else if (response.playing && response.muted) {
            updateChannelTime(response.channelName, 1);
          }
        });
      }, 1000);
    }
  });
}

// Set up an event listener for tab updates (e.g., navigating to a new URL)
// to trigger the handleTabSwitch function if the updated URL is a Twitch channel
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && /^https:\/\/www\.twitch\.tv\//.test(tab.url)) {
    handleTabSwitch(tabId);
  }
});

// Set up an event listener for tab activation (e.g., switching between tabs)
// to trigger the handleTabSwitch function for the newly activated tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleTabSwitch(activeInfo.tabId);
});


