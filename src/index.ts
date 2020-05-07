import { runStreetView } from "./StreetView/StreetView";
import { GlobalGoogle } from "./Google";
import { activateKeyboard } from "./RunningController/Keyboard";

const debug = require("debug")("index.js");
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
export const run = (google: GlobalGoogle, container: HTMLElement) => {
    const position = getLocationFromGoogleMap(
        "https://www.google.com/maps/@40.6110615,140.9482871,3a,75y,12.48h,93.15t/"
    ) ?? {
        lat: 34.769844,
        lng: 138.014135,
    };
    const pov = {
        heading: 0,
        pitch: 0,
    };
    const streetViewPanorama = new google.maps.StreetViewPanorama(container, {
        position: position,
        pov: pov,
        zoom: 1,
    });
    const { moveForward, moveBackward, unload } = runStreetView({
        google,
        panorama: streetViewPanorama,
    });
    activateKeyboard(document.body, {
        onUp() {
            debug("Up");
            moveForward();
        },
        onDown() {
            debug("Down");
            moveBackward();
        },
        onRight() {
            debug("Right");
        },
        onLeft() {
            debug("Left");
        },
    });
    return () => {
        streetViewPanorama.unbindAll();
        return Promise.all([unload()]);
    };
};
