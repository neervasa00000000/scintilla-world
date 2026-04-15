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
    let actionDuration = 0;
    let currentActionEndTime = 0;

    // Create the panda SVG with animation states
    function createPandaSVG(scaleX = 1, walkOffset = 0, currentAction = 'idle', animFrame = 0) {
      const isSleeping = currentAction === 'sleeping';
      const isHappy = currentAction === 'happy';
      const isEating = currentAction === 'eating';
      const isFighting = currentAction === 'fighting';
      const isLevelup = currentAction === 'levelup';
      
      const eyeY = isSleeping ? 11 : 9;
      const eyeHeight = isSleeping ? 1 : 2;
      let mouthY = 16;
      let mouthWidth = 2;
      let mouthHeight = 1;
      
      // Eating animation - mouth opens and closes
      if (isEating) {
        const eatCycle = Math.sin(animFrame * 0.5) * 0.5 + 0.5;
        mouthY = 15 + eatCycle * 2;
        mouthWidth = 3;
        mouthHeight = 1 + Math.floor(eatCycle * 2);
      }
      
      // Happy - bigger smile
      if (isHappy) {
        mouthY = 17;
        mouthWidth = 4;
        mouthHeight = 2;
      }
      
      // Fighting - angry eyes and mouth
      const fightingIntensity = isFighting ? Math.sin(animFrame * 0.8) * 0.3 : 0;
      
      // Levelup - sparkle effect
      const sparkles = isLevelup ? Array.from({length: 8}, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 + animFrame * 0.3;
        const radius = 18;
        const sparkleX = 16 + Math.cos(angle) * radius;
        const sparkleY = 16 + Math.sin(angle) * radius;
        return `<circle cx="${sparkleX}" cy="${sparkleY}" r="1.5" fill="#8b5cf6" opacity="0.8"/>`;
      }).join('') : '';
      
      return `
        <svg viewBox="0 0 32 32" style="width: 100%; height: 100%; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));" shape-rendering="crispEdges" transform="scaleX(${scaleX})">
          <ellipse cx="16" cy="29" rx="${8 + Math.abs(walkOffset)}" ry="1.5" fill="rgba(0,0,0,0.2)"/>
          ${sparkles}
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
              ${isFighting ? `
                <rect x="${7 + fightingIntensity}" y="9" width="2" height="2" rx="1" fill="#dc2626"/>
                <rect x="${19 - fightingIntensity}" y="9" width="2" height="2" rx="1" fill="#dc2626"/>
              ` : `
                <rect x="${8 + (isHappy ? 0 : 2)}" y="${eyeY}" width="${isHappy ? 5 : 2}" height="${eyeHeight}" rx="1" fill="white"/>
                <rect x="${19 + (isHappy ? 0 : 2)}" y="${eyeY}" width="${isHappy ? 5 : 2}" height="${eyeHeight}" rx="1" fill="white"/>
              `}
            `}
            <rect x="15" y="13" width="2" height="2" fill="#111827"/>
            ${isEating ? `
              <rect x="14" y="${mouthY}" width="${mouthWidth}" height="${mouthHeight}" fill="#f59e0b"/>
              <rect x="13" y="${mouthY + 1}" width="1" height="1" fill="#f59e0b"/>
              <rect x="17" y="${mouthY + 1}" width="1" height="1" fill="#f59e0b"/>
            ` : isHappy ? `
              <path d="M ${15 - mouthWidth/2} ${mouthY} Q 16 ${mouthY + mouthHeight} ${15 + mouthWidth/2} ${mouthY}" stroke="#374151" stroke-width="1.5" fill="none"/>
            ` : isFighting ? `
              <rect x="14" y="16" width="4" height="2" fill="#dc2626"/>
              <rect x="13" y="17" width="1" height="1" fill="#dc2626"/>
              <rect x="18" y="17" width="1" height="1" fill="#dc2626"/>
            ` : `
              <rect x="15" y="${mouthY}" width="${mouthWidth}" height="${mouthHeight}" fill="#374151"/>
            `}
            <rect x="${8 + walkOffset}" y="15" width="4" height="6" fill="#111827"/>
            <rect x="${20 + walkOffset}" y="15" width="4" height="6" fill="#111827"/>
            <rect x="${9 + walkOffset}" y="22" width="4" height="6" fill="#1f2937"/>
            ${isEating ? `<rect x="${12 + Math.sin(animFrame * 0.5) * 2}" y="14" width="2" height="2" fill="#f59e0b" opacity="0.8"/>` : ''}
            ${isLevelup ? `<text x="16" y="8" text-anchor="middle" font-size="6" fill="#8b5cf6" font-weight="bold">⬆</text>` : ''}
          </g>
        </svg>
      `;
    }

    pandaContainer.innerHTML = createPandaSVG(1, 0, 'idle', 0);
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

    let clickTimer = 0;
    let isClick = false;
    
    pandaContainer.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        clickTimer = Date.now();
        isClick = true;
        isDragging = false;
        dragOffsetX = e.clientX - x;
        dragOffsetY = e.clientY - y;
        pandaContainer.style.cursor = 'grab';
        e.preventDefault();
      }
    });
    
    pandaContainer.addEventListener('click', (e) => {
      if (isClick && !isDragging && (Date.now() - clickTimer < 200)) {
        // Click (not drag) - trigger random gesture
        const gestures = ['happy', 'eating', 'fighting', 'levelup'];
        const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
        action = randomGesture;
        actionDuration = 0;
        if (randomGesture === 'eating') {
          currentActionEndTime = actionDuration + 120;
        } else if (randomGesture === 'happy') {
          currentActionEndTime = actionDuration + 90;
        } else if (randomGesture === 'fighting') {
          currentActionEndTime = actionDuration + 100;
        } else if (randomGesture === 'levelup') {
          currentActionEndTime = actionDuration + 150;
        }
        actionTimer = 0;
      }
      isClick = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (isClick) {
        const moveDistance = Math.abs(e.clientX - (x + dragOffsetX)) + Math.abs(e.clientY - (y + dragOffsetY));
        if (moveDistance > 5) {
          // Moved more than 5px, treat as drag
          isDragging = true;
          isClick = false;
          pandaContainer.style.cursor = 'grabbing';
        }
      }
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
      isClick = false;
    });

    // Roaming animation
    function animate() {
      if (!isDragging) {
        frame++;
        actionDuration++;
        
        // Check if current gesture action should end
        if (currentActionEndTime > 0 && actionDuration >= currentActionEndTime) {
          if (action === 'eating' || action === 'happy' || action === 'fighting' || action === 'levelup') {
            action = 'idle';
            currentActionEndTime = 0;
            actionTimer = 0;
          }
        }
        
        // Randomly change action (including gestures)
        actionTimer++;
        if (actionTimer > 300 + Math.random() * 200 && currentActionEndTime === 0) {
          const actions = [
            'idle', 
            'walking', 
            'walking', 
            'walking',
            'eating',      // Gesture
            'happy',       // Gesture
            'fighting',    // Gesture
            'levelup'      // Gesture
          ];
          const selectedAction = actions[Math.floor(Math.random() * actions.length)];
          
          // Set action duration for gestures
          if (selectedAction === 'eating') {
            action = 'eating';
            currentActionEndTime = actionDuration + 120; // 2 seconds at 60fps
          } else if (selectedAction === 'happy') {
            action = 'happy';
            currentActionEndTime = actionDuration + 90; // 1.5 seconds
          } else if (selectedAction === 'fighting') {
            action = 'fighting';
            currentActionEndTime = actionDuration + 100; // ~1.7 seconds
          } else if (selectedAction === 'levelup') {
            action = 'levelup';
            currentActionEndTime = actionDuration + 150; // 2.5 seconds
          } else {
            action = selectedAction;
            if (action === 'walking') {
              direction = Math.random() > 0.5 ? 1 : -1;
              speed = 0.3 + Math.random() * 0.7;
            }
          }
          actionTimer = 0;
        }

        // Move if walking (but not during gestures)
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
        const svg = createPandaSVG(scaleX, walkFrame, action, frame);
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
