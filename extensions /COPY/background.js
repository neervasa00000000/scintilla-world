chrome.runtime.onInstalled.addListener(() => {
    console.log("COPY Extension Installed Successfully");
    // Initialize storage if empty
    chrome.storage.local.get(['copy_records'], (res) => {
        if (!res.copy_records) {
            chrome.storage.local.set({ copy_records: [] });
        }
    });
});
