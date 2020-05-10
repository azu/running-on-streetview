import { PanoramaState, runStreetView } from "./StreetView/StreetView";
import { GlobalGoogle } from "./Google";
import { activateKeyboard } from "./RunningController/Keyboard";
import throttle from "lodash-es/throttle";
import { activateMotionCamera } from "./RunningController/MotionCamera";
import { LoadMap } from "./RunningController/LoadMap/LoadMap";
import { StatusButton } from "./RunningController/StatusButton/StatusButton";
import { VisibleController } from "./RunningController/VisibleController/VisibleController";
import { ShareButton } from "./RunningController/ShareButton/ShareButton";
import { createLocationTracker } from "./LocationTracker/LocationTracker";
import { globalState } from "./GlobalState";
import LatLngLiteral = google.maps.LatLngLiteral;
import StreetViewPov = google.maps.StreetViewPov;

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
/**
 * Create Street View Url
 * https://stackoverflow.com/questions/387942/google-street-view-url
 * @param position
 * @param pov
 */
const createStreetViewURL = (position: LatLngLiteral, pov: StreetViewPov): string => {
    return `https://www.google.com/maps/?layer=c&cbll=${position.lat},${position.lng}&cbp=,${pov.heading},,${pov.pitch}`;
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
export const run = async ({
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
    const TRIAL_COUNT_LIMIT = 30; // Hard limit for TRAIAL
    const locationTracker = await createLocationTracker();
    type Status = "stopped" | "running" | "expired-trial";
    const state: { playingStatus: Status; forwardStepCount: number } = {
        playingStatus: "running",
        forwardStepCount: 0,
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
            state.forwardStepCount += step;
            if (state.forwardStepCount > FORWARD_ONE_MOVE) {
                state.forwardStepCount = 0;
                return {
                    status: "MOVE",
                } as const;
            }
            return {
                status: "NO_MOVE",
            } as const;
        },
        togglePlayingStatus() {
            if (state.playingStatus === "expired-trial") {
                return;
            }
            if (state.playingStatus === "stopped") {
                this.playStatus();
            } else if (state.playingStatus === "running") {
                this.stopStatus();
            }
        },
        playStatus() {
            if (state.playingStatus === "expired-trial") {
                return;
            }
            state.playingStatus = "running";
            mediaStream?.getVideoTracks().forEach((track) => {
                track.enabled = true;
            });
            updateStatusButton({
                text: state.playingStatus + "🏃",
            });
        },
        stopStatus() {
            state.playingStatus = "stopped";
            mediaStream?.getVideoTracks().forEach((track) => {
                track.enabled = false;
            });
            updateStatusButton({
                text: state.playingStatus + "🛑",
            });
        },
        expireTrial() {
            action.stopStatus();
            state.playingStatus = "expired-trial";
            updateStatusButton({
                text: "Expired Trial 😞",
            });
        },
    };
    const lastPanoramaState = action.loadPanoramaState();
    const initialPosition = lastPanoramaState?.position ?? getLocationFromGoogleMap(config.defaultMapUrl);
    if (!initialPosition) {
        throw new Error("initial position can not parsed" + JSON.stringify(initialPosition));
    }
    const initialPov = lastPanoramaState?.pov ?? {
        heading: 0,
        pitch: 0,
    };
    const streetViewPanorama = new google.maps.StreetViewPanorama(container, {
        position: initialPosition,
        pov: initialPov,
        pano: lastPanoramaState?.pano,
        zoom: 1,
    });
    const { moveForward, moveBackward, turnLeft, turnRight, unload: unloadStreetView, getState, load } = runStreetView(
        {
            google,
            panorama: streetViewPanorama,
        },
        {
            onStatusChange: async () => {
                const panoramaState = getState();
                await locationTracker.add({
                    position: panoramaState.position,
                    timestamp: Date.now(),
                });
                action.savePanoramaState(panoramaState);
                debug("save panoramaState %o", panoramaState);
                updateShareButton({
                    mapUrl: createStreetViewURL(panoramaState.position, panoramaState.pov),
                });
                if (globalState.trial) {
                    const countOfTrackingRecord = await locationTracker.count();
                    if (countOfTrackingRecord >= TRIAL_COUNT_LIMIT) {
                        action.expireTrial();
                        alert(`Expire trial running!

Please get Google Maps API by own!

For more details, please see https://github.com/azu/running-on-streetview 
`);
                    }
                }
            },
        }
    );
    const throttleForward = throttle(
        () => {
            if (state.playingStatus === "stopped" || state.playingStatus === "expired-trial") {
                return;
            }
            moveForward();
        },
        config.throttleForward ?? 300,
        {
            trailing: false,
        }
    );
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
                    if (state.playingStatus === "stopped" || state.playingStatus === "expired-trial") {
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

    const { unload: unloadLoadMap } = LoadMap(controlContainer, {
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
    const { update: updateStatusButton, unload: unloadStatusButton } = StatusButton(controlContainer, {
        text: state.playingStatus,
        onClick() {
            if (state.playingStatus === "expired-trial") {
                alert("Trial already expired! Please see https://github.com/azu/running-on-streetview");
                window.open("https://github.com/azu/running-on-streetview", "_blank");
                return;
            }
            action.togglePlayingStatus();
        },
    });
    const unloadVisibleController = VisibleController({
        onVisibleChange(status: VisibilityState) {
            if (status === "hidden") {
                action.stopStatus();
            }
        },
    });
    const { unload: unloadShareButton, update: updateShareButton } = ShareButton(controlContainer, {
        mapUrl: createStreetViewURL(initialPosition, initialPov),
    });
    return () => {
        return Promise.all([
            streetViewPanorama.unbindAll(),
            unloadStreetView(),
            unloadLoadMap(),
            unloadStatusButton(),
            unloadVisibleController(),
            unloadShareButton(),
        ]);
    };
};
