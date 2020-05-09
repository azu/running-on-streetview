import { run, RunConfig } from "./index";
import { globalState } from "./GlobalState";

const debug = require("debug")("running:bootstrap");
const videoElement = document.querySelector("#js-RunningController-video") as HTMLVideoElement;
const inputGoogleMapAPIKey = document.querySelector("#js-google-map-api-key") as HTMLInputElement;

class Deferred<T extends any> {
    promise: Promise<T>;
    private _resolve!: (value?: T) => void;
    private _reject!: (reason?: Error) => void;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    resolve(value?: any) {
        this._resolve(value);
    }

    reject(reason?: Error) {
        this._reject(reason);
    }
}

const _videoStream = new Deferred<MediaStream>();
(window as any).initRunningStreetView = () => {
    if (globalState.start) {
        debug("already started");
        return;
    }
    const container = document.querySelector("#js-street-view") as HTMLElement;
    const controlContainer = document.querySelector("#js-RunningController-control") as HTMLDivElement;
    // URL Hacking
    const url = new URL(location.href);
    const config: RunConfig = {
        throttleForward: url.searchParams.get("throttleForward")
            ? Number(url.searchParams.get("throttleForward"))
            : undefined,
        throttleBackward: url.searchParams.get("throttleBackward")
            ? Number(url.searchParams.get("throttleBackward"))
            : undefined,
        defaultForwardStep: url.searchParams.get("defaultForwardStep")
            ? Number(url.searchParams.get("defaultForwardStep"))
            : undefined,
        defaultMapUrl:
            url.searchParams.get("defaultMapUrl") ??
            "https://www.google.com/maps/@40.6110615,140.9482871,0a,73.7y,1.16h,90t/data=!3m4!1e1!3m2!1sjBsnn5UBd-c3qy7uOagvpQ!2e0?source=apiv3",
    };
    controlContainer.innerHTML = "";
    _videoStream.promise
        .then(async (mediaStream) => {
            globalState.start = true;
            const unload = await run({
                google,
                container,
                controlContainer: controlContainer,
                mediaStream,
                videoElement,
                config,
            });
            window.addEventListener(
                "unload",
                () => {
                    unload();
                },
                {
                    once: true,
                }
            );
        })
        .catch(async () => {
            globalState.start = true;
            const unload = await run({ google, container, controlContainer: controlContainer, config });
            window.addEventListener(
                "unload",
                () => {
                    unload();
                },
                {
                    once: true,
                }
            );
        });
};
const getMediaStream = () => {
    return navigator.mediaDevices.enumerateDevices().then(function (mediaDeviceInfoList) {
        var videoDevices = mediaDeviceInfoList.filter(function (deviceInfo) {
            return deviceInfo.kind == "videoinput";
        });
        if (videoDevices.length < 1) {
            alert("Not found video devices");
            throw new Error("Not found video devices");
        }
        return navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                deviceId: videoDevices[0].deviceId,
            },
        });
    });
};

const loadForm = document.querySelector("#js-RunningController-controlForm") as HTMLFormElement;
const trialButton = document.querySelector("#js-trial-button") as HTMLButtonElement;
const load = async (APIKey?: string) => {
    let GoogleMapAPIKey =
        APIKey ?? process.env.GOOGLE_MAP_API_KEY ?? new URL(location.href).searchParams.get("GOOGLE_MAP_API_KEY");
    if (GoogleMapAPIKey && /trial/i.test(GoogleMapAPIKey)) {
        GoogleMapAPIKey = "AIzaSyCHT-d9KNsSTGuoNyNsLHnUlTQ4RifkEK0"; // Trial API Key
    }
    if (!GoogleMapAPIKey) {
        throw new Error("No defined GoogleMapAPIKey");
    }
    if (APIKey) {
        globalState.googleMapAPIKey = APIKey;
    }
    const API = `https://maps.googleapis.com/maps/api/js?key=${GoogleMapAPIKey}&callback=initRunningStreetView`;
    const script = document.createElement("script");
    script.defer = true;
    script.async = true;
    script.src = API;
    document.head.appendChild(script);
    // Get MediaStream
    const mediaStream = await getMediaStream();
    debug("MediaStream", mediaStream);
    _videoStream.resolve(mediaStream);
    videoElement.srcObject = mediaStream;
};
trialButton.addEventListener("click", () => {
    load("trial");
});
loadForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const inputValue = inputGoogleMapAPIKey.value;
    load(inputValue);
});

window.addEventListener("DOMContentLoaded", () => {
    const apiKey = globalState.googleMapAPIKey;
    if (apiKey) {
        inputGoogleMapAPIKey.value = apiKey;
    }
});
