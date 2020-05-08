import StreetViewPov = google.maps.StreetViewPov;
import StreetViewLink = google.maps.StreetViewLink;
import StreetViewPanorama = google.maps.StreetViewPanorama;
import LatLngLiteral = google.maps.LatLngLiteral;
import { GlobalGoogle } from "../Google";
import PQueue from "p-queue";

const debug = require("debug")("running:StreetView");
const findFarthestLink = (currentPov: StreetViewPov, links: StreetViewLink[]): StreetViewLink | undefined => {
    // TODO: should to use sorted algorithm
    const currentPovHeading = currentPov.heading ?? 0;
    let farthestDiff = 0; // heading is 0 ~ 360
    let farthestLinkIndex = -1;
    links.forEach((link, index) => {
        if (link.heading === undefined) {
            return;
        }
        // If currentPov: 10, links heading [50, 359]
        // The nearest is heading:359 instead of heading:50
        const simpleDiff = Math.abs(currentPovHeading - link.heading);
        const degreeDiff = Math.min(simpleDiff, 360 - simpleDiff);
        if (degreeDiff >= farthestDiff) {
            farthestDiff = degreeDiff;
            farthestLinkIndex = index;
        }
    });
    const farthestLink = links[farthestLinkIndex];
    debug(
        "farthestLink: %o, index: %i, current pov: %o, links: %o",
        farthestLink,
        farthestLinkIndex,
        currentPov,
        links
    );
    return farthestLink;
};

const findNearestLink = (currentPov: StreetViewPov, links: StreetViewLink[]): StreetViewLink | undefined => {
    // TODO: should to use sorted algorithm
    const currentPovHeading = currentPov.heading ?? 0;
    let nearestDiff = 360; // heading is 0 ~ 360
    let nearestLinkIndex = -1;
    links.forEach((link, index) => {
        if (link.heading === undefined) {
            return;
        }
        // If currentPov: 10, links heading [50, 359]
        // The nearest is heading:359 instead of heading:50
        const simpleDiff = Math.abs(currentPovHeading - link.heading);
        const degreeDiff = Math.min(simpleDiff, 360 - simpleDiff);
        if (degreeDiff <= nearestDiff) {
            nearestDiff = degreeDiff;
            nearestLinkIndex = index;
        }
    });
    const nearestLink = links[nearestLinkIndex];
    debug("nearestLink: %o, index: %i, current pov: %o, links: %o", nearestLink, nearestLinkIndex, currentPov, links);
    return nearestLink;
};

const createTransitionPovList = (currentPov: StreetViewPov, nextPov: StreetViewPov) => {
    const currentHeading = currentPov.heading ?? 0;
    const nextHeading = nextPov.heading ?? 0;
    const simpleDiff = Math.abs(currentHeading - nextHeading);
    const diff = Math.min(simpleDiff, 360 - simpleDiff);
    if (currentHeading > nextHeading) {
        return [
            currentHeading - diff / 6,
            currentHeading - diff / 5,
            currentHeading - diff / 4,
            currentHeading - diff / 3,
            currentHeading - diff / 2,
            currentHeading - diff / 1.5,
            currentHeading - diff / 1.3,
            currentHeading - diff / 1.2,
            currentHeading - diff / 1.1,
            nextHeading,
        ];
    } else {
        return [
            currentHeading + diff / 6,
            currentHeading + diff / 5,
            currentHeading + diff / 4,
            currentHeading + diff / 3,
            currentHeading + diff / 2,
            currentHeading + diff / 1.5,
            currentHeading + diff / 1.3,
            currentHeading + diff / 1.2,
            currentHeading + diff / 1.1,
            nextHeading,
        ];
    }
};

export type PanoramaState = {
    pov: StreetViewPov;
    pano: string;
    position: LatLngLiteral;
};
export type runStreetViewProps = {
    onStatusChange: () => void;
};
export const runStreetView = (
    { google, panorama }: { google: GlobalGoogle; panorama: StreetViewPanorama },
    props: runStreetViewProps
) => {
    /**
     * Correct pov to nearest link
     */
    const correctForwardPov = () => {
        const nearestLink = findNearestLink(panorama.getPov(), panorama.getLinks());
        if (!nearestLink) {
            return;
        }
        panorama.setPov({
            heading: nearestLink.heading,
            pitch: 0,
        });
    };
    const statusChangedListener = google.maps.event.addListener(panorama, "status_changed", () => {
        if (panorama.getStatus() == "OK") {
            correctForwardPov();
            props.onStatusChange();
        }
    });

    return {
        load({ pov, pano, position }: Partial<PanoramaState>) {
            pov && panorama.setPov(pov);
            pano && panorama.setPano(pano);
            position && panorama.setPosition(position);
        },
        getState(): PanoramaState {
            return {
                pov: panorama.getPov(),
                pano: panorama.getPano(),
                position: panorama.getPosition().toJSON(),
            };
        },
        turnRight(delta: number) {
            const pov = panorama.getPov();
            panorama.setPov({
                heading: (pov.heading ?? 0) + delta,
                pitch: pov.pitch,
            });
        },
        turnLeft(delta: number) {
            const pov = panorama.getPov();
            panorama.setPov({
                heading: (pov.heading ?? 0) - delta,
                pitch: pov.pitch,
            });
        },
        moveForward() {
            const pov = panorama.getPov();
            const nearestLink = findNearestLink(pov, panorama.getLinks());
            if (!nearestLink) {
                debug("Not found nearestLink");
                return;
            }
            if (!nearestLink.pano) {
                debug("NearestLink has not pano");
                return;
            }
            panorama.setPano(nearestLink.pano);
            panorama.setPov(pov);
        },
        moveBackward() {
            const pov = panorama.getPov();
            const farthestLink = findFarthestLink(pov, panorama.getLinks());
            if (!farthestLink) {
                debug("Not found farthestLink");
                return;
            }
            if (!farthestLink.pano) {
                debug("farthestLink has not pano");
                return;
            }
            const queue = new PQueue({ concurrency: 1 });
            const transitionHeadings = createTransitionPovList(pov, {
                heading: farthestLink.heading,
                pitch: pov.pitch,
            });
            transitionHeadings.forEach((heading) => {
                queue.add(() => {
                    panorama.setPov({
                        heading: heading,
                        pitch: pov.pitch,
                    });
                });
                queue.add(() => new Promise((resolve) => setTimeout(resolve, 64)));
            });
            queue.add(() => {
                panorama.setPano(farthestLink.pano!);
            });
            return queue.onIdle();
        },
        unload() {
            google.maps.event.removeListener(statusChangedListener);
        },
    };
};
