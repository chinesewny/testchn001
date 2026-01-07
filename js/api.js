const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwQNjMSE06u5xO4dtyipa5P-YzoaicppubdwlUgMpaX4L4TUjk3-xY2PRnzhS42AxZe/exec";

export async function fetchData() {
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getData&t=${new Date().getTime()}`);
        if (!res.ok) throw new Error("Network response was not ok");
        return await res.json();
    } catch (e) {
        console.error("Fetch Error:", e);
        throw e;
    }
}

export async function sendData(payload) {
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch (e) {
        console.error("Send Error:", e);
        throw e;
    }
}