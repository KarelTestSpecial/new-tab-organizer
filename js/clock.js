function updateClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');

    if (!timeEl || !dateEl) {
        return;
    }

    const now = new Date();

    // Format time as HH:MM (24-hour)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${hours}:${minutes}`;

    // Format date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString(undefined, options);
}

// Update the clock immediately and then every second
updateClock();
setInterval(updateClock, 1000);
