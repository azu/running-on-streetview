import { PanoramaState, runStreetView } from "./StreetView/StreetView";
import { GlobalGoogle } from "./Google";
import { activateKeyboard } from "./RunningController/Keyboard";
import { throttle } from "lodash-es";
import { activateMotionCamera } from "./RunningController/MotionCamera";
import { LoadMap } from "./RunningController/LoadMap/LoadMap";
import LatLngLiteral = google.maps.LatLngLiteral;
import { StatusButton } from "./RunningController/StatusButton/StatusButton";

const debug = require("debug")("running:index.js");
/**
 * Parse Google Map URL
 * https://www.google.co.jp/maps/@41.5486745,-2.3158727,3a,75y,195.8h,91.7t/data=!3m7!1e1!3m5!1sywBlNB_DZ2_yHwE-tspDDw!2e0!6s%2F%2Fgeo1.ggpht.com%2Fcbk%3Fpanoid%3DywBlNB_DZ2_yHwE-tspDDw%26output%3Dthumbnail%26cb_client%3Dmaps_sv.tactile.gps%26thumb%3D2%26w%3D203%26h%3D100%26yaw%3D134.36525%26pitch%3D0%26thumbfov%3D100!7i13312!8i6656?hl=ja
 * @param mapURL
 */
const getLocationFromGoogleMap = (mapURL: string): LatLngLiteral | undefined => {
    const match = new URL(mapURL).pathname.match(/@([-\d.]+),([-\d.]+)/);
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
export type RunConfig = {
    /**
     * To load Default Map URL
     */
    defaultMapUrl: string;
    /**
     * 0 < x < 100
     * Higher fast forward
     * Default: 20
     */
    defaultForwardStep?: number;
    /**
     * throttle time(ms) to forward
     * Default: 300
     */
    throttleForward?: number;
    /**
     * throttle time(ms) to backwar
     * Default: 1000
     */
    throttleBackward?: number;
};
export const run = ({
    google,
    container,
    controlContainer,
    mediaStream,
    videoElement,
    config,
}: {
    google: GlobalGoogle;
    container: HTMLElement;
    controlContainer: HTMLElement;
    mediaStream?: MediaStream;
    videoElement?: HTMLVideoElement;
    config: RunConfig;
}) => {
    const DEFAULT_FORWARD_STEP = config.defaultForwardStep ?? 20;
    const FORWARD_ONE_MOVE = 100; // 100 step = One Move
    type Status = "stopped" | "running";
    const state: { playingStatus: Status; forwardCount: number } = {
        playingStatus: "running",
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
        togglePlayingStatus() {
            if (state.playingStatus === "stopped") {
                state.playingStatus = "running";
            } else if (state.playingStatus === "running") {
                state.playingStatus = "stopped";
            }
        },
    };
    const lastPanoramaState = action.loadPanoramaState();
    const position = lastPanoramaState?.position ?? getLocationFromGoogleMap(config.defaultMapUrl);
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
    const { moveForward, moveBackward, turnLeft, turnRight, unload, getState, load } = runStreetView(
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
    const throttleForward = throttle(moveForward, config.throttleForward ?? 300, {
        trailing: false,
    });
    const throttleBackward = throttle(moveBackward, config.throttleBackward ?? 1000, {
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
                    if (state.playingStatus === "stopped") {
                        return;
                    }
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

    const unLoadMap = LoadMap(controlContainer, {
        onSubmit(url) {
            const position = getLocationFromGoogleMap(url);
            if (!position) {
                return;
            }
            load({
                position: position,
            });
        },
    });
    const { setText, unload: unloadStatusButton } = StatusButton(controlContainer, {
        defaultText: state.playingStatus,
        onClick() {
            action.togglePlayingStatus();
            setText(state.playingStatus);
        },
    });
    return () => {
        streetViewPanorama.unbindAll();
        return Promise.all([unload(), unLoadMap(), unloadStatusButton()]);
    };
};
