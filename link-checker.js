// Link click tracker and fallback
function trackLinkClick(product, url) {
    gtag('event', 'click', {
        'event_category': 'outbound',
        'event_label': product,
        'value': 1
    });
    
    // Try to open the link
    window.open(url, '_blank');
    
    return false;
}

// Fallback for product links - if main product link fails, go to homepage
function safeProductLink(product) {
    const baseUrl = 'https://nutrithrive.com.au';
    const productUrls = {
        'powder': baseUrl + '/products/moringa-powder/',
        '4pack': baseUrl + '/collections/all',
        'capsules': baseUrl + '/products/moringa-capsules/',
        'default': baseUrl + '/collections/all'
    };
    
    return productUrls[product] || productUrls['default'];
}
