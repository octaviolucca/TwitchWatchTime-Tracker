// Set up a message listener for the getChannelInfo event
// It retrieves the channel name and playing status of the video and sends it back as a response
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "getChannelInfo") {
    const video = document.querySelector("video");
    const channelLink = document.querySelector("h1.CoreText-sc-1txzju1-0.ScTitleText-sc-d9mj2s-0.jKVhlu.igzOaC.InjectLayout-sc-1i43xsx-0.tNDkq.tw-title");
    const channelName = channelLink ? channelLink.textContent.trim() : "unknown";
    const playing = video && !video.paused;
    sendResponse({ channelName, playing });
  }
});

