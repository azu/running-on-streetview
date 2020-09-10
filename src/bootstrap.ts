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

const videoDeviceId = Number(localStorage.getItem("running-on-streetview.videoDeviceId") || 0);
const videoStream = new Deferred<MediaStream>();
type MediaController = { currentMediaStream: MediaStream | null; show(): void; hide(): void };
const mediaController: MediaController = {
    currentMediaStream: null,
    show() {
        this.currentMediaStream?.getVideoTracks().forEach((track) => {
            track.enabled = true;
        });
    },
    hide() {
        this.currentMediaStream?.getVideoTracks().forEach((track) => {
            track.enabled = false;
        });
    },
};
videoElement.addEventListener("click", async () => {
    const currentVideoDeviceId = Number(localStorage.getItem("running-on-streetview.videoDeviceId") || 0);
    const mediaDeviceInfoList = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = mediaDeviceInfoList.filter(function (deviceInfo) {
        return deviceInfo.kind == "videoinput";
    });
    const nextVideoDeviceId = videoDevices.length - 1 > currentVideoDeviceId ? currentVideoDeviceId + 1 : 0;
    const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            deviceId: videoDevices[nextVideoDeviceId].deviceId,
        },
    });
    mediaController.currentMediaStream = mediaStream;
    videoElement.srcObject = mediaStream;
    localStorage.setItem("running-on-streetview.videoDeviceId", String(nextVideoDeviceId));
});

const defaultMapList = [
    // Japan - Aomori
    "https://www.google.com/maps/@40.6110615,140.9482871,0a,73.7y,1.16h,90t/data=!3m4!1e1!3m2!1sjBsnn5UBd-c3qy7uOagvpQ!2e0?source=apiv3",
    // Brazil - Acre
    "https://www.google.com/maps/@-8.1860182,-70.5101287,3a,75y,252.53h,102.85t/data=!3m7!1e1!3m5!1sO9kg48c0xjsHIWFP9QM6Ag!2e0!6s%2F%2Fgeo3.ggpht.com%2Fcbk%3Fpanoid%3DO9kg48c0xjsHIWFP9QM6Ag%26output%3Dthumbnail%26cb_client%3Dmaps_sv.tactile.gps%26thumb%3D2%26w%3D203%26h%3D100%26yaw%3D157.61475%26pitch%3D0%26thumbfov%3D100!7i13312!8i6656",
    // Kalaallit Nunaat - Søndre Strømfjord
    "https://www.google.com/maps/@67.1527397,-50.0521744,3a,67.4y,283.74h,94.2t/data=!3m6!1e1!3m4!1sbIfSL7uZ9W6xtYU8Mp9agA!2e0!7i13312!8i6656",
    // France - Pont Valentré
    "https://www.google.com/maps/@44.4448569,1.4308371,3a,75y,85.52h,94.54t/data=!3m6!1e1!3m4!1sAF1QipOfdZnfctTa1Zx0b-nfGLpgDW4Y0e8jz2Bp7gRb!2e10!7i5376!8i2688",
    // Česko - Olomouc
    "https://www.google.com/maps/@49.5949955,17.2569492,2a,75y,147.03h,93.75t/data=!3m6!1e1!3m4!1sj3Ao-jUkkaCmD7X68dbioQ!2e0!7i13312!8i6656",
];
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
            url.searchParams.get("defaultMapUrl") ?? defaultMapList[Math.floor(Math.random() * defaultMapList.length)], // random
    };
    controlContainer.innerHTML = "";
    videoStream.promise
        .then(async () => {
            globalState.start = true;
            const unload = await run({
                google,
                container,
                controlContainer: controlContainer,
                mediaController,
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
        const videoDevices = mediaDeviceInfoList.filter(function (deviceInfo) {
            return deviceInfo.kind == "videoinput";
        });
        if (videoDevices.length < 1) {
            alert("Not found video devices");
            throw new Error("Not found video devices");
        }
        return navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                deviceId: videoDevices[videoDeviceId].deviceId,
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
        globalState.googleMapAPIKey = GoogleMapAPIKey;
    }
    const API = `https://maps.googleapis.com/maps/api/js?key=${GoogleMapAPIKey}&callback=initRunningStreetView`;
    const script = document.createElement("script");
    script.defer = true;
    script.async = true;
    script.src = API;
    document.head.appendChild(script);
    // Get MediaStream
    const mediaStream = await getMediaStream();
    mediaController.currentMediaStream = mediaStream;
    videoStream.resolve(mediaStream);
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
