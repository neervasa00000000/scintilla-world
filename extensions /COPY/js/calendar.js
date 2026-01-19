// Calendar Reminder Tool Logic
// Parses natural language dates and generates calendar events

// Date Parser Engine (from calendar-reminder tool)
const SimpleDateParser = {
  parse: function(text, refDate) {
    refDate = refDate || new Date();
    const now = new Date(refDate);
    const textLower = text.toLowerCase().trim();
    
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    const findMonth = function(monthStr) {
      if (!monthStr) return -1;
      const m = monthStr.toLowerCase();
      let idx = months.findIndex(month => month.startsWith(m));
      if (idx === -1) idx = monthAbbr.findIndex(abbr => abbr === m);
      return idx;
    };
    
    const parseYear = function(yearStr) {
      if (!yearStr) return now.getFullYear();
      const y = parseInt(yearStr);
      if (y < 100) {
        const currentYear = now.getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        return y >= (currentYear % 100) ? currentCentury + y : currentCentury + 100 + y;
      }
      return y;
    };

    const removeOrdinal = function(str) {
      return str.replace(/(\d+)(st|nd|rd|th)/i, '$1');
    };

    const extractTime = function(text) {
      const timePatterns = [
        /(\d{1,2}):(\d{2})\b/i,
        /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
        /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
        /(\d{1,2})(?::(\d{2}))?(am|pm)/i
      ];
      
      for (const pattern of timePatterns) {
        const match = text.match(pattern);
        if (match) {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2] || '0');
          const ampm = match[3] || null;
          
          if (hour > 23) continue;
          if (!ampm && hour > 12 && hour <= 23) return { hour, minute, ampm: null };
          if (!ampm && hour > 12) continue;
          
          return { hour, minute, ampm };
        }
      }
      return { hour: 12, minute: 0, ampm: null };
    };

    const extractTimeRange = function(text) {
      const rangePatterns = [
        /(?:from\s+|at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+to\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
        /(?:from\s+|at\s+)?(\d{1,2})(?::(\d{2}))?\s+to\s+(\d{1,2})(?::(\d{2}))?/i
      ];
      
      for (const pattern of rangePatterns) {
        const match = text.match(pattern);
        if (match) {
          const hasAmpm = match[3] && (match[3].toLowerCase() === 'am' || match[3].toLowerCase() === 'pm');
          
          if (hasAmpm) {
            return {
              start: { hour: parseInt(match[1]), minute: parseInt(match[2] || '0'), ampm: match[3] },
              end: { hour: parseInt(match[4]), minute: parseInt(match[5] || '0'), ampm: match[6] }
            };
          } else {
            const startHour = parseInt(match[1]);
            const startMinute = parseInt(match[2] || '0');
            const endHour = parseInt(match[3]);
            const endMinute = parseInt(match[4] || '0');
            
            if (startHour >= 0 && startHour <= 23 && endHour >= 0 && endHour <= 23 &&
                startMinute >= 0 && startMinute <= 59 && endMinute >= 0 && endMinute <= 59) {
              return {
                start: { hour: startHour, minute: startMinute, ampm: null },
                end: { hour: endHour, minute: endMinute, ampm: null }
              };
            }
          }
        }
      }
      return null;
    };

    const patterns = [
      // "on 1/11/26 i have meeting at 7 pm" or "1/11/2026 at 7 pm"
      {
        regex: /(?:on\s+)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:.*?\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i,
        handler: function(match, fullText) {
          const month = parseInt(match[1], 10) - 1;
          const day = parseInt(match[2], 10);
          const year = parseYear(match[3]);
          let date = new Date(year, month, day, 12, 0, 0, 0);
          if (isNaN(date.getTime())) return null;

          // If explicit time captured in same match, use it
          if (match[4]) {
            let hour = parseInt(match[4], 10);
            let minute = parseInt(match[5] || '0', 10);
            const ampm = match[6];
            if (ampm) {
              if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
              if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
            }
            date.setHours(hour, minute, 0, 0);
            return { start: { date: () => date } };
          }

          // Otherwise, look for a time elsewhere in the string
          const time = extractTime(fullText);
          return this.parseTime(date, time.hour, time.minute, time.ampm);
        }
      },
      // "<time> tomorrow" e.g. "meet at 9 pm tomorrow"
      {
        regex: /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+tomorrow/i,
        handler: function(match) {
          const date = new Date(now);
          date.setDate(date.getDate() + 1);
          return this.parseTime(date, match[1], match[2] || '0', match[3]);
        }
      },
      // "at 12 at saturday" or "meeting at 12 at saturday"
      {
        regex: /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(?:on\s+|at\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
        handler: function(match) {
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDay = dayNames.indexOf(match[4].toLowerCase());
          const date = new Date(now);
          date.setHours(12, 0, 0, 0);
          const currentDay = date.getDay();
          let daysAhead = targetDay - currentDay;
          if (daysAhead <= 0) daysAhead += 7;
          date.setDate(date.getDate() + daysAhead);
          return this.parseTime(date, match[1], match[2] || '0', match[3]);
        }
      },
      // "saturday at 12" / "on saturday at 12"
      {
        regex: /(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:.*?\s+)?at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
        handler: function(match) {
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDay = dayNames.indexOf(match[1].toLowerCase());
          const date = new Date(now);
          date.setHours(12, 0, 0, 0);
          const currentDay = date.getDay();
          let daysAhead = targetDay - currentDay;
          if (daysAhead <= 0) daysAhead += 7;
          date.setDate(date.getDate() + daysAhead);
          return this.parseTime(date, match[2], match[3] || '0', match[4]);
        }
      },
      {
        regex: /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+today/i,
        handler: function(match) {
          const date = new Date(now);
          return this.parseTime(date, match[1], match[2] || '0', match[3]);
        }
      },
      {
        regex: /today\s+(?:.*?\s+)?at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
        handler: function(match) {
          const date = new Date(now);
          return this.parseTime(date, match[1], match[2] || '0', match[3]);
        }
      },
      {
        regex: /today\s+(?:.*?\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
        handler: function(match) {
          const date = new Date(now);
          return this.parseTime(date, match[1], match[2] || '0', match[3]);
        }
      },
      {
        regex: /tomorrow\s+(?:.*?\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
        handler: function(match) {
          const date = new Date(now);
          date.setDate(date.getDate() + 1);
          return this.parseTime(date, match[1], match[2] || '0', match[3]);
        }
      },
      {
        regex: /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
        handler: function(match) {
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDay = dayNames.indexOf(match[1].toLowerCase());
          const date = new Date(now);
          date.setHours(12, 0, 0, 0);
          const currentDay = date.getDay();
          let daysAhead = targetDay - currentDay;
          if (daysAhead <= 0) daysAhead += 7;
          date.setDate(date.getDate() + daysAhead);
          return this.parseTime(date, match[2], match[3] || '0', match[4]);
        }
      },
      {
        regex: /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/i,
        handler: function(match, fullText) {
          const monthIdx = findMonth(match[1]);
          if (monthIdx < 0) return null;
          const day = parseInt(match[2]);
          const year = parseYear(match[3]);
          let date = new Date(year, monthIdx, day, 12, 0, 0, 0);
          
          const timeRange = extractTimeRange(fullText);
          if (timeRange) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            let startHour = timeRange.start.hour;
            let startMinute = timeRange.start.minute;
            if (timeRange.start.ampm) {
              if (timeRange.start.ampm.toLowerCase() === 'pm' && startHour !== 12) startHour += 12;
              if (timeRange.start.ampm.toLowerCase() === 'am' && startHour === 12) startHour = 0;
            }
            startDate.setHours(startHour, startMinute, 0, 0);
            let endHour = timeRange.end.hour;
            let endMinute = timeRange.end.minute;
            if (timeRange.end.ampm) {
              if (timeRange.end.ampm.toLowerCase() === 'pm' && endHour !== 12) endHour += 12;
              if (timeRange.end.ampm.toLowerCase() === 'am' && endHour === 12) endHour = 0;
            }
            endDate.setHours(endHour, endMinute, 0, 0);
            if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
            return { start: { date: () => startDate }, end: { date: () => endDate } };
          }
          
          const time = extractTime(fullText);
          return this.parseTime(date, time.hour, time.minute, time.ampm);
        }
      },
      {
        regex: /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
        handler: function(match, fullText) {
          const monthIdx = findMonth(match[1]);
          if (monthIdx < 0) return null;
          const day = parseInt(removeOrdinal(match[2]));
          const year = match[3] ? parseInt(match[3]) : now.getFullYear();
          let date = new Date(year, monthIdx, day, 12, 0, 0, 0);
          if (!match[3] && date < now) date.setFullYear(year + 1);
          
          const timeRange = extractTimeRange(fullText);
          if (timeRange) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            let startHour = timeRange.start.hour;
            let startMinute = timeRange.start.minute;
            if (timeRange.start.ampm) {
              if (timeRange.start.ampm.toLowerCase() === 'pm' && startHour !== 12) startHour += 12;
              if (timeRange.start.ampm.toLowerCase() === 'am' && startHour === 12) startHour = 0;
            }
            startDate.setHours(startHour, startMinute, 0, 0);
            let endHour = timeRange.end.hour;
            let endMinute = timeRange.end.minute;
            if (timeRange.end.ampm) {
              if (timeRange.end.ampm.toLowerCase() === 'pm' && endHour !== 12) endHour += 12;
              if (timeRange.end.ampm.toLowerCase() === 'am' && endHour === 12) endHour = 0;
            }
            endDate.setHours(endHour, endMinute, 0, 0);
            if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
            return { start: { date: () => startDate }, end: { date: () => endDate } };
          }
          
          if (match[4]) {
            let hour = parseInt(match[4]);
            let minute = parseInt(match[5] || '0');
            if (match[6]) {
              if (match[6].toLowerCase() === 'pm' && hour !== 12) hour += 12;
              if (match[6].toLowerCase() === 'am' && hour === 12) hour = 0;
            }
            date.setHours(hour, minute, 0, 0);
            return { start: { date: () => date } };
          }
          
          const time = extractTime(fullText);
          return this.parseTime(date, time.hour, time.minute, time.ampm);
        }
      },
      {
        regex: /(?:in\s+)?(\d+)\s+(hour|minute)s?/i,
        handler: function(match) {
          const date = new Date(now);
          const amount = parseInt(match[1]);
          if(match[2].startsWith('hour')) date.setHours(date.getHours() + amount);
          else date.setMinutes(date.getMinutes() + amount);
          return { start: { date: () => date } };
        }
      }
    ];

    for (let pattern of patterns) {
      let match = textLower.match(pattern.regex);
      if (match) {
        return [pattern.handler.call(this, match, textLower)];
      }
    }

    return [];
  },

  parseTime: function(date, hour, minute, ampm) {
    hour = parseInt(hour || 12);
    minute = parseInt(minute || 0);
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
      if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
    }
    const newDate = new Date(date);
    newDate.setHours(hour, minute, 0, 0);
    return { start: { date: () => newDate } };
  }
};

// Main function to process calendar input
function processEventInput(text) {
  if (!text) return { error: "No text provided" };

  const now = new Date();
  const results = SimpleDateParser.parse(text, now);

  if (!results || results.length === 0 || !results[0].start) {
    return { error: "Could not find a valid date/time." };
  }

  const startDate = results[0].start.date();
  const endDate = results[0].end ? results[0].end.date() : new Date(startDate.getTime() + 60 * 60 * 1000);

  let summary = text
    .replace(/\b(next|tomorrow|today|at|on|in)\b/gi, '')
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d+/gi, '')
    .replace(/\d{1,2}:\d{2}\s*(am|pm)?/gi, '')
    .trim();
  
  if (summary.length < 2) summary = "New Event";

  return {
    success: true,
    title: summary,
    start: startDate,
    end: endDate,
    links: {
      google: generateGoogleLink(summary, startDate, endDate, text),
      ics: generateICS(summary, startDate, endDate, text)
    }
  };
}

function generateGoogleLink(title, start, end, description) {
  const format = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent(description)}`;
}

function generateICS(title, start, end, description) {
  const format = (d) => d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') + 'T' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') + '00';

  return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${title}
DTSTART:${format(start)}
DTEND:${format(end)}
DESCRIPTION:${description}
END:VEVENT
END:VCALENDAR`;
}

// Calendar UI Functions
function initCalendar() {
  if (!el.calendarInput) return;
  
  // Handle input and generate calendar
  safelyOn(el.calendarInput, 'keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCalendarGenerate();
    }
  });
  
  safelyOn(el.calendarGenerateBtn, 'click', handleCalendarGenerate);
}

function handleCalendarGenerate() {
  const input = el.calendarInput;
  const resultDiv = el.calendarResult;
  const btn = el.calendarGenerateBtn;
  
  if (!input || !resultDiv || !btn) return;
  
  const text = input.value.trim();
  
  if (!text) {
    showToast('Please enter an event', 'error');
    return;
  }
  
  btn.disabled = true;
  btn.textContent = 'Processing...';
  resultDiv.innerHTML = '';
  
  try {
    const result = processEventInput(text);
    
    if (result.error) {
      resultDiv.innerHTML = `<div class="calendar-error">${escapeHTML(result.error)}</div>`;
      showToast(result.error, 'error');
    } else {
      const startStr = result.start.toLocaleString();
      const endStr = result.end.toLocaleString();
      
      resultDiv.innerHTML = `
        <div class="calendar-success">
          <div class="calendar-event-title">${escapeHTML(result.title)}</div>
          <div class="calendar-event-time">${startStr} - ${endStr}</div>
          <div class="calendar-actions">
            <a href="${result.links.google}" target="_blank" class="calendar-btn calendar-btn-primary">
              <i class="fa-solid fa-calendar-plus"></i> Add to Google Calendar
            </a>
            <a href="data:text/calendar;charset=utf8,${encodeURIComponent(result.links.ics)}" download="event.ics" class="calendar-btn calendar-btn-secondary">
              <i class="fa-solid fa-download"></i> Download ICS
            </a>
          </div>
        </div>
      `;
      showToast('Event created successfully!', 'success');
    }
  } catch (error) {
    console.error('Calendar error:', error);
    resultDiv.innerHTML = `<div class="calendar-error">Error processing event: ${error.message}</div>`;
    showToast('Error processing event', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Event';
  }
}

