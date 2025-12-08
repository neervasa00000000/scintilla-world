// Content script to inject the panda on web pages - full screen roaming
(function() {
  'use strict';

  // Don't inject on chrome:// pages or extension pages
  if (window.location.protocol === 'chrome:' || 
      window.location.protocol === 'chrome-extension:' ||
      window.location.hostname === '' ||
      document.getElementById('pixelpet-panda-container')) {
    return;
  }

  // Wait for body to be ready
  if (!document.body) {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        initPanda();
      }
    });
    observer.observe(document.documentElement, { childList: true });
    return;
  }

  function initPanda() {
    // Create a container for the panda
    const pandaContainer = document.createElement('div');
    pandaContainer.id = 'pixelpet-panda-container';
    pandaContainer.style.cssText = `
      position: fixed;
      width: 120px;
      height: 120px;
      z-index: 999999;
      pointer-events: auto;
      user-select: none;
      transition: none;
    `;

    // Panda state
    let x = Math.random() * (window.innerWidth - 120);
    let y = Math.random() * (window.innerHeight - 120);
    let direction = Math.random() > 0.5 ? 1 : -1; // 1 for right, -1 for left
    let speed = 0.5 + Math.random() * 0.5; // Random speed
    let frame = 0;
    let action = 'idle';
    let actionTimer = 0;

    // Create the panda SVG with animation states
    function createPandaSVG(scaleX = 1, walkOffset = 0, isSleeping = false) {
      const eyeY = isSleeping ? 11 : 9;
      const eyeHeight = isSleeping ? 1 : 2;
      const mouthY = isSleeping ? 16 : 16;
      
      return `
        <svg viewBox="0 0 32 32" style="width: 100%; height: 100%; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));" shape-rendering="crispEdges" transform="scaleX(${scaleX})">
          <ellipse cx="16" cy="29" rx="${8 + Math.abs(walkOffset)}" ry="1.5" fill="rgba(0,0,0,0.2)"/>
          <g>
            <rect x="${19 + walkOffset}" y="22" width="4" height="6" fill="#1f2937"/>
            <path d="M8 12 h16 v14 h-16 Z" fill="white"/>
            <rect x="7" y="13" width="1" height="12" fill="white"/>
            <rect x="24" y="13" width="1" height="12" fill="white"/>
            <rect x="8" y="13" width="16" height="5" fill="#374151"/>
            <rect x="7" y="14" width="1" height="3" fill="#374151"/>
            <rect x="24" y="14" width="1" height="3" fill="#374151"/>
            <rect x="5" y="4" width="22" height="13" fill="white"/>
            <rect x="4" y="5" width="1" height="11" fill="white"/>
            <rect x="27" y="5" width="1" height="11" fill="white"/>
            <rect x="4" y="2" width="6" height="4" fill="#111827"/>
            <rect x="22" y="2" width="6" height="4" fill="#111827"/>
            ${isSleeping ? `
              <rect x="8" y="11" width="6" height="1" fill="#111827"/>
              <rect x="18" y="11" width="6" height="1" fill="#111827"/>
            ` : `
              <rect x="7" y="8" width="7" height="6" fill="#111827" rx="1"/>
              <rect x="18" y="8" width="7" height="6" fill="#111827" rx="1"/>
              <rect x="${8 + (action === 'happy' ? 0 : 2)}" y="${eyeY}" width="${action === 'happy' ? 5 : 2}" height="${eyeHeight}" rx="1" fill="white"/>
              <rect x="${19 + (action === 'happy' ? 0 : 2)}" y="${eyeY}" width="${action === 'happy' ? 5 : 2}" height="${eyeHeight}" rx="1" fill="white"/>
            `}
            <rect x="15" y="13" width="2" height="2" fill="#111827"/>
            <rect x="15" y="${mouthY}" width="2" height="1" fill="#374151"/>
            <rect x="${8 + walkOffset}" y="15" width="4" height="6" fill="#111827"/>
            <rect x="${20 + walkOffset}" y="15" width="4" height="6" fill="#111827"/>
            <rect x="${9 + walkOffset}" y="22" width="4" height="6" fill="#1f2937"/>
          </g>
        </svg>
      `;
    }

    pandaContainer.innerHTML = createPandaSVG();
    document.body.appendChild(pandaContainer);

    // Update position
    function updatePosition() {
      pandaContainer.style.left = x + 'px';
      pandaContainer.style.top = y + 'px';
    }

    // Initial position
    updatePosition();

    // Make it draggable
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    pandaContainer.style.cursor = 'grab';

    pandaContainer.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isDragging = true;
        dragOffsetX = e.clientX - x;
        dragOffsetY = e.clientY - y;
        pandaContainer.style.cursor = 'grabbing';
        action = 'idle';
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        x = e.clientX - dragOffsetX;
        y = e.clientY - dragOffsetY;
        
        // Keep within viewport
        const maxX = window.innerWidth - 120;
        const maxY = window.innerHeight - 120;
        x = Math.max(0, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));
        
        updatePosition();
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        pandaContainer.style.cursor = 'grab';
        // Resume roaming after drag
        setTimeout(() => {
          action = 'walking';
          direction = Math.random() > 0.5 ? 1 : -1;
        }, 500);
      }
    });

    // Roaming animation
    function animate() {
      if (!isDragging) {
        frame++;
        
        // Randomly change action
        actionTimer++;
        if (actionTimer > 300 + Math.random() * 200) {
          const actions = ['idle', 'walking', 'walking', 'walking'];
          action = actions[Math.floor(Math.random() * actions.length)];
          if (action === 'walking') {
            direction = Math.random() > 0.5 ? 1 : -1;
            speed = 0.3 + Math.random() * 0.7;
          }
          actionTimer = 0;
        }

        // Move if walking
        if (action === 'walking') {
          x += direction * speed;
          
          // Bounce off edges
          if (x <= 0) {
            x = 0;
            direction = 1;
          } else if (x >= window.innerWidth - 120) {
            x = window.innerWidth - 120;
            direction = -1;
          }
          
          // Randomly change vertical position
          if (Math.random() < 0.01) {
            y += (Math.random() - 0.5) * 50;
            y = Math.max(0, Math.min(y, window.innerHeight - 120));
          }
          
          updatePosition();
        }

        // Update animation
        const walkFrame = action === 'walking' ? Math.sin(frame * 0.2) * 2 : 0;
        const scaleX = direction === 1 ? 1 : -1;
        const svg = createPandaSVG(scaleX, walkFrame, action === 'sleeping');
        pandaContainer.innerHTML = svg;
      }

      requestAnimationFrame(animate);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      x = Math.min(x, window.innerWidth - 120);
      y = Math.min(y, window.innerHeight - 120);
      updatePosition();
    });

    // Start animation
    action = 'walking';
    animate();

    console.log('🐼 PixelPet panda is roaming on this page!');
  }

  // Initialize immediately if body exists
  initPanda();
})();
