import { PanoramaState, runStreetView } from "./StreetView/StreetView";
import { GlobalGoogle } from "./Google";
import { activateKeyboard } from "./RunningController/Keyboard";
import { throttle } from "lodash-es";
import { activateMotionCamera } from "./RunningController/MotionCamera";

const debug = require("debug")("running:index.js");
const getLocationFromGoogleMap = (mapURL: string) => {
    const match = new URL(mapURL).pathname.match(/@([\d.]+),([\d.]+)/);
    if (!match) {
        return undefined;
    }
    const [_all, lat, lng] = match;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        throw new Error(`${_all} is not number`);
    }
    return {
        lat: latNum,
        lng: lngNum,
    };
};
export const run = ({
    google,
    container,
    mediaStream,
    videoElement,
}: {
    google: GlobalGoogle;
    container: HTMLElement;
    mediaStream?: MediaStream;
    videoElement?: HTMLVideoElement;
}) => {
    const DEFAULT_FORWARD_STEP = 20;
    const FORWARD_ONE_MOVE = 100; // 100 step = One Move
    const state = {
        forwardCount: 0,
    };
    const action = {
        savePanoramaState(state: PanoramaState) {
            try {
                localStorage.setItem("panorama-state", JSON.stringify(state));
            } catch (error) {
                console.error(error);
            }
        },
        loadPanoramaState(): PanoramaState | undefined {
            try {
                const item = localStorage.getItem("panorama-state");
                if (!item) {
                    return undefined;
                }
                return JSON.parse(item);
            } catch (error) {
                console.error(error);
                return;
            }
        },
        stepForward(step = DEFAULT_FORWARD_STEP) {
            state.forwardCount += step;
            if (state.forwardCount > FORWARD_ONE_MOVE) {
                state.forwardCount = 0;
                return {
                    status: "MOVE",
                } as const;
            }
            return {
                status: "NO_MOVE",
            } as const;
        },
    };
    const lastPanoramaState = action.loadPanoramaState();
    const position = lastPanoramaState?.position ??
        getLocationFromGoogleMap("https://www.google.com/maps/@40.6110615,140.9482871,3a,75y,12.48h,93.15t/") ?? {
            lat: 34.769844,
            lng: 138.014135,
        };
    const pov = lastPanoramaState?.pov ?? {
        heading: 0,
        pitch: 0,
    };
    const streetViewPanorama = new google.maps.StreetViewPanorama(container, {
        position: position,
        pov: pov,
        pano: lastPanoramaState?.pano,
        zoom: 1,
    });
    const { moveForward, moveBackward, turnLeft, turnRight, unload, getState } = runStreetView(
        {
            google,
            panorama: streetViewPanorama,
        },
        {
            onStatusChange: () => {
                const panoramaState = getState();
                action.savePanoramaState(panoramaState);
                debug("save panoramaState %o", panoramaState);
            },
        }
    );
    const throttleForward = throttle(moveForward, 300, {
        trailing: false,
    });
    const throttleBackward = throttle(moveBackward, 1000, {
        trailing: false,
    });
    activateKeyboard(document.body, {
        onUp() {
            debug("Up");
            throttleForward();
        },
        onDown() {
            debug("Down");
            throttleBackward();
        },
        onRight() {
            debug("Right");
            turnRight(5);
        },
        onLeft() {
            debug("Left");
            turnLeft(5);
        },
    });
    if (mediaStream && videoElement) {
        const thresholdPixel = 1000;
        activateMotionCamera(
            { mediaStream, videoElement },
            {
                onTick({ diffPixelCount }) {
                    if (diffPixelCount < thresholdPixel) {
                        return;
                    }
                    debug("diffPixelCount", diffPixelCount);
                    const { status } = action.stepForward();
                    if (status === "MOVE") {
                        throttleForward();
                    }
                },
            }
        );
    }
    return () => {
        streetViewPanorama.unbindAll();
        return Promise.all([unload()]);
    };
};
