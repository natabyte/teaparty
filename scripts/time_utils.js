// millisToFormattedTime convertes a delta (dt) into a formatted human-readable
// time in the format 0:00:00.
//
// dt - The interval in milliseconds to convert to hours, minutes, and seconds.
//
// Returns the static "0:00:00" in case dt <= 0, otherwise, returns the provided
// milliseconds in the format 13:07:24. (hours:minutes:seconds).
export const millisToFormattedTime = (dt) => {
    if (dt <= 0) {
        return "0:00:00"
    }
    const totalSeconds = Math.floor(dt / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
