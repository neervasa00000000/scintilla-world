// Listens for extraction requests from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script active, listening for messages.");
    if (request.action === "extractFromPage") {
        const bodyText = document.body.innerText;
        sendResponse({ text: bodyText });
    }
    return true; 
});