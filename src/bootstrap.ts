import { run } from "./index";

const debug = require("debug")("bootstrap");
const globalState = {
    start: false,
};
(window as any).initRunningStreetView = () => {
    if (globalState.start) {
        debug("already started");
        return;
    }
    const container = document.querySelector("#js-street-view") as HTMLElement;
    const unload = run(google, container);
    globalState.start = true;
    window.addEventListener(
        "unload",
        () => {
            unload();
        },
        {
            once: true,
        }
    );
};
const loadButton = document.querySelector("#js-load-button") as HTMLButtonElement;
loadButton.addEventListener("click", () => {
    // Just call index.ts's entry point after loading libraries
    let GoogleMapAPIKey =
        process.env.GOOGLE_MAP_API_KEY ?? new URL(location.href).searchParams.get("GOOGLE_MAP_API_KEY");
    if (!GoogleMapAPIKey) {
        GoogleMapAPIKey = window.prompt("Input your Google Map AP IKey");
    }
    if (!GoogleMapAPIKey) {
        throw new Error("No defined GoogleMapAPIKey");
    }
    const API = `https://maps.googleapis.com/maps/api/js?key=${GoogleMapAPIKey}&callback=initRunningStreetView`;
    const script = document.createElement("script");
    script.defer = true;
    script.async = true;
    script.src = API;
    document.head.appendChild(script);
});
