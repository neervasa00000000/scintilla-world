// Notes/Todo Tool Logic
// Manages notes with completion status, deletion, and deadlines

// Save notes to storage
function saveNotes() {
    try {
        chrome.storage.local.set({ copy_notes: state.notes });
    } catch (error) {
        console.error('Error saving notes:', error);
        showToast('Failed to save notes', 'error');
    }
}

// Add a new note
function addNote() {
    if (!el || !el.notesInput) {
        return;
    }
    
    const input = el.notesInput;
    const deadlineInput = el.notesDeadlineInput;
    
    const text = input.value.trim();
    if (!text) {
        showToast('Please enter a note', 'error');
        return;
    }
    
    const deadlineValue = deadlineInput ? deadlineInput.value : '';
    let deadline = null;
    if (deadlineValue) {
        deadline = new Date(deadlineValue);
        if (isNaN(deadline.getTime())) {
            showToast('Invalid deadline date', 'error');
            return;
        }
    }
    
    const note = {
        id: Date.now(),
        text: text,
        completed: false,
        deadline: deadline,
        createdAt: new Date().toISOString()
    };
    
    state.notes.unshift(note);
    saveNotes();
    renderNotes();
    
    input.value = '';
    if (deadlineInput) deadlineInput.value = '';
    
    showToast('Note added', 'success');
}

// Toggle note completion
function toggleNote(id) {
    const note = state.notes.find(n => n.id === id);
    if (note) {
        note.completed = !note.completed;
        saveNotes();
        renderNotes();
    }
}

// Delete a note
function deleteNote(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    saveNotes();
    renderNotes();
    showToast('Note deleted', 'success');
}

// Format deadline display
function formatDeadline(deadline) {
    if (!deadline) return null;
    
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) return null;
    
    const now = new Date();
    const diff = deadlineDate - now;
    const daysDiff = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) {
        return { text: `${Math.abs(daysDiff)} day${Math.abs(daysDiff) !== 1 ? 's' : ''} overdue`, class: 'deadline-overdue' };
    } else if (daysDiff === 0) {
        return { text: 'Due today', class: 'deadline-today' };
    } else if (daysDiff === 1) {
        return { text: 'Due tomorrow', class: 'deadline-soon' };
    } else if (daysDiff <= 7) {
        return { text: `Due in ${daysDiff} days`, class: 'deadline-soon' };
    } else {
        const options = { month: 'short', day: 'numeric', year: deadlineDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined };
        return { text: `Due ${deadlineDate.toLocaleDateString('en-US', options)}`, class: 'deadline-future' };
    }
}

// Render all notes
function renderNotes() {
    if (!el || !el.notesList) {
        return;
    }
    
    const container = el.notesList;
    
    if (!state.notes || state.notes.length === 0) {
        container.innerHTML = `
            <div class="empty-records">
                <div class="empty-records-icon"><i class="fa-solid fa-sticky-note"></i></div>
                <div class="empty-records-title">No notes yet</div>
                <div class="empty-records-subtitle">Add your first note above</div>
            </div>
        `;
        return;
    }
    
    // Sort notes: incomplete first, then by deadline (soonest first), then by creation date (newest first)
    const sortedNotes = [...state.notes].sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        if (a.deadline && b.deadline) {
            return new Date(a.deadline) - new Date(b.deadline);
        }
        if (a.deadline && !b.deadline) return -1;
        if (!a.deadline && b.deadline) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    container.innerHTML = sortedNotes.map(note => {
        const deadlineInfo = formatDeadline(note.deadline);
        const deadlineHtml = deadlineInfo ? `<div class="note-deadline ${deadlineInfo.class}"><i class="fa-solid fa-calendar-days"></i> ${deadlineInfo.text}</div>` : '';
        
        return `
            <div class="note-item ${note.completed ? 'note-completed' : ''}" data-note-id="${note.id}">
                <div class="note-content">
                    <label class="note-checkbox">
                        <input type="checkbox" ${note.completed ? 'checked' : ''} data-note-id="${note.id}">
                        <span class="note-checkmark"></span>
                    </label>
                    <div class="note-text-wrapper">
                        <div class="note-text">${escapeHTML(note.text)}</div>
                        ${deadlineHtml}
                    </div>
                </div>
                <button class="note-delete-btn" data-note-id="${note.id}" title="Delete note">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
    
    // Attach event listeners to all checkboxes and delete buttons
    container.querySelectorAll('.note-checkbox input[type="checkbox"]').forEach(checkbox => {
        const noteId = parseInt(checkbox.dataset.noteId);
        checkbox.addEventListener('change', () => toggleNote(noteId));
    });
    
    container.querySelectorAll('.note-delete-btn').forEach(btn => {
        const noteId = parseInt(btn.dataset.noteId);
        btn.addEventListener('click', () => deleteNote(noteId));
    });
}

// Initialize notes feature (called from popup-main.js)
function initNotes() {
    try {
        // Ensure el is defined before proceeding
        if (!el || !el.notesList) {
            return;
        }
        
        // Always render notes (will show empty state if no notes)
        renderNotes();
        
        // Handle add note button
        safelyOn(el.notesAddBtn, 'click', addNote);
        
        // Handle Enter key in input
        safelyOn(el.notesInput, 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addNote();
            }
        });
    } catch (error) {
        console.error('Notes: Error in initNotes:', error);
    }
}

