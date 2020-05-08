import { run, RunConfig } from "./index";

const debug = require("debug")("running:bootstrap");
const videoElement = document.querySelector("#js-RunningController-video") as HTMLVideoElement;
const globalState = {
    start: false,
};

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
    // For hack from URL
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
            "https://www.google.com/maps/@40.6110615,140.9482871,3a,75y,12.48h,93.15t/",
    };
    controlContainer.innerHTML = "";
    _videoStream.promise
        .then((mediaStream) => {
            globalState.start = true;
            const unload = run({
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
        .catch(() => {
            globalState.start = true;
            const unload = run({ google, container, controlContainer: controlContainer, config });
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

const loadButton = document.querySelector("#js-load-button") as HTMLButtonElement;
loadButton.addEventListener("click", async () => {
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
    // Get MediaStream
    const mediaStream = await getMediaStream();
    debug("MediaStream", mediaStream);
    _videoStream.resolve(mediaStream);
    videoElement.srcObject = mediaStream;
});
